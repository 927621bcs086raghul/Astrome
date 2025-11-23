import axios from 'axios';
import { call, put, select, takeEvery } from 'redux-saga/effects';
import { setElevations, setFresnelPolygon, setPlaceName } from './towersSlice';

// helper: haversine (km)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const metersPerDegLat = 111320;
const metersPerDegLon = (lat) => Math.abs(Math.cos((lat * Math.PI) / 180) * 111320);

const interpolateLatLng = (A, B, t) => ({
  lat: A.lat + (B.lat - A.lat) * t,
  lng: A.lng + (B.lng - A.lng) * t,
});

function buildFresnelPolygon(A, B, freqGHz, samples = 50) {
  const distKm = haversine(A.lat, A.lng, B.lat, B.lng);
  const D = distKm * 1000;
  if (D === 0) return [];
  const fHz = freqGHz * 1e9;
  const c = 3e8;
  const lambda = c / fHz;
  const midLat = (A.lat + B.lat) / 2;
  const dLat = (B.lat - A.lat) * metersPerDegLat;
  const dLon = (B.lng - A.lng) * metersPerDegLon(midLat);
  const pointsLeft = [];
  const pointsRight = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const pt = interpolateLatLng(A, B, t);
    const d1 = D * t;
    const d2 = D * (1 - t);
    const r = Math.sqrt((lambda * d1 * d2) / (d1 + d2 || 1));
    const vx = dLon;
    const vy = dLat;
    let px = -vy;
    let py = vx;
    const plen = Math.sqrt(px * px + py * py) || 1;
    px /= plen;
    py /= plen;
    const offEast = px * r;
    const offNorth = py * r;
    const latLeft = pt.lat + offNorth / metersPerDegLat;
    const lngLeft = pt.lng + offEast / metersPerDegLon(pt.lat);
    const latRight = pt.lat - offNorth / metersPerDegLat;
    const lngRight = pt.lng - offEast / metersPerDegLon(pt.lat);
    pointsLeft.push([latLeft, lngLeft]);
    pointsRight.push([latRight, lngRight]);
  }
  return [...pointsLeft, ...pointsRight.reverse()];
}

// Selector helpers
const selectTowers = (state) => state.towers.towers;

function* handleFetchFresnel(action) {
  try {
    const { fromId, toId } = action.payload;
    const towers = yield select(selectTowers);
    const A = towers.find((t) => t.id === fromId);
    const B = towers.find((t) => t.id === toId);
    if (!A || !B) return;
    const freq = (A.freq + B.freq) / 2;
    const key = `${fromId}-${toId}`;
    // build polygon locally
    const polygon = buildFresnelPolygon(A, B, freq, 80);
    yield put(setFresnelPolygon({ key, polygon }));

    // fetch elevations via Open-Elevation
    try {
      const samples = 20;
      const coords = [];
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const pt = interpolateLatLng(A, B, t);
        coords.push(`${pt.lat},${pt.lng}`);
      }
      const url = `https://api.open-elevation.com/api/v1/lookup?locations=${coords.join('|')}`;
      const res = yield call(axios.get, url);
      if (res && res.data && res.data.results) {
        yield put(setElevations({ key, results: res.data.results }));
      }
    } catch (e) {
      // ignore elevation errors
    }

    // reverse geocode both endpoints via Nominatim
    try {
      const urlA = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${A.lat}&lon=${A.lng}`;
      const urlB = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${B.lat}&lon=${B.lng}`;
      const [resA, resB] = yield call(Promise.all, [axios.get(urlA), axios.get(urlB)]);
      if (resA && resA.data && resA.data.display_name) {
        yield put(setPlaceName({ key: `${A.lat.toFixed(6)},${A.lng.toFixed(6)}`, name: resA.data.display_name }));
      }
      if (resB && resB.data && resB.data.display_name) {
        yield put(setPlaceName({ key: `${B.lat.toFixed(6)},${B.lng.toFixed(6)}`, name: resB.data.display_name }));
      }
    } catch (e) {
      // ignore
    }
  } catch (err) {
    // console.error(err);
  }
}

export default function* rootSaga() {
  yield takeEvery('towers/fetchFresnel', handleFetchFresnel);
}
