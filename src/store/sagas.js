import axios from 'axios';
import { call, put, select, takeEvery } from 'redux-saga/effects';
import { buildFresnelPolygon, interpolateLatLng } from '../utils/fresnel';
import { setElevations, setFresnelPolygon, setPlaceName } from './towersSlice';

// Selector helpers
const selectTowers = (state) => state.towers.towers;

function* handleFetchFresnel(action) {
  console.log('Saga: handleFetchFresnel', action.payload);
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
      console.log('Fetching elevations from Open-Elevation for coords:', coords);
      console.log('URL:', `https://api.open-elevation.com/api/v1/lookup?locations=${coords.join('|')}`);
      const url = `https://api.open-elevation.com/api/v1/lookup?locations=${coords.join('|')}`;
      const res = yield call(axios.get, url);
      console.log('Fetched elevations from Open-Elevation', res);
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
