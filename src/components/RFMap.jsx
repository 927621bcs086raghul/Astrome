import { useEffect, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import { useDispatch, useSelector } from 'react-redux';
import {
  addTower as addTowerAction,
  clearFresnel as clearFresnelAction,
  setPlaceName as setPlaceNameAction,
  updateTower as updateTowerAction,
} from '../store/towersSlice';

// split components
import EditFreqModal from './EditFreqModal';
import FresnelPolygons from './FresnelPolygons';
import LinkLayer from './LinkLayer';
import MapClickHandler from './MapClickHandler';
import TowerLayer from './TowerLayer';

// Fresnel helpers are used by LinkLayer/LinkPolyline

// Tower Icon


// Fresnel helpers come from shared utilities in `src/utils/fresnel.js`

// (Map click handler moved to `src/components/MapClickHandler.jsx`)

// =============================
// MAIN MAP COMPONENT
// =============================
export default function RFMap({ mode }) {
  const dispatch = useDispatch();
  const towers = useSelector((s) => s.towers.towers);
  const links = useSelector((s) => s.towers.links);
  const fresnelPolygons = useSelector((s) => s.towers.fresnel);
  const placeCache = useSelector((s) => s.towers.places);

  const [editingTower, setEditingTower] = useState(null);
  const [tempFreq, setTempFreq] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = (text, type = "info", ms = 3000) => {
    setToast({ text, type });
    setTimeout(() => setToast(null), ms);
  };

  // fresnel polygons are managed by LinkLayer; nothing to do here

  // Check if coordinate is on water or land based on Nominatim response
  const isWater = (data) => {
    if (!data) return true; // treat missing/null data as water
    if (data.error) return true; // treat API errors as water
    const waterKeywords = ['ocean', 'sea', 'bay', 'gulf', 'strait', 'channel', 'lake', 'river'];
    const displayName = (data.display_name || '').toLowerCase();
    const address = data.address || {};
    const addressStr = JSON.stringify(address).toLowerCase();
    return waterKeywords.some((kw) => displayName.includes(kw) || addressStr.includes(kw));
  };

  const reverseGeocode = async (lat, lng) => {
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    if (placeCache[key]) return placeCache[key];

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, {
        headers: {
          "Accept-Language": "en",
        },
      });
      if (!res.ok) {
        // Treat HTTP errors as water
        return { name: null, isWater: true };
      }
      const data = await res.json();
      // Check if API returned error (e.g., {"error": "Unable to geocode"})
      if (data.error) {
        return { name: null, isWater: true };
      }
      const name = data.display_name || null;
      dispatch(setPlaceNameAction({ key, name }));
      return { name, isWater: isWater(data) };
    } catch (e) {
      // Treat network errors as water
      return { name: null, isWater: true };
    }
  };

  // Prefetch place names for towers (cached)
  useEffect(() => {
    for (const t of towers) {
      const key = `${t.lat.toFixed(6)},${t.lng.toFixed(6)}`;
      if (!placeCache[key]) {
        // fire-and-forget
        reverseGeocode(t.lat, t.lng);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [towers]);

  // Keep fresnel polygons in sync with links: remove polygons for links that no longer exist
  useEffect(() => {
    // remove any fresnel polygons that no longer correspond to links
    const valid = new Set();
    links.forEach((l) => {
      valid.add(`${l.fromId}-${l.toId}`);
      valid.add(`${l.toId}-${l.fromId}`);
    });
    Object.keys(fresnelPolygons).forEach((k) => {
      if (!valid.has(k)) dispatch(clearFresnelAction(k));
    });
  }, [links]);

  // Add Tower (validate not on water)
  const addTower = async (latlng) => {
    const { lat, lng } = latlng;

    // Check if location is on water
    const geoResult = await reverseGeocode(lat, lng);
    if (geoResult?.isWater) {
      showToast('Cannot place tower on water. Please select a land location.', 'error');
      return;
    }

    const newTower = {
      id: Date.now(),
      lat,
      lng,
      freq: 5,
    };

    dispatch(addTowerAction(newTower));
  };

  // Update Tower
  const updateTowerById = (id, data) => {
    dispatch(updateTowerAction({ id, data }));
  };

  // Link interaction and creation are handled by TowerLayer and LinkLayer

  return (
    <>
      {/* ========== Edit Frequency Modal ========== */}
      <EditFreqModal
        editingTower={editingTower}
        tempFreq={tempFreq}
        setTempFreq={setTempFreq}
        setEditingTower={setEditingTower}
        updateTowerById={updateTowerById}
      />

      {/* ========== MAP ========== */}
      <MapContainer
        center={[12.97, 77.59]}
        zoom={6}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Click to add tower */}
        <MapClickHandler mode={mode} onClick={(latlng) => addTower(latlng)} />

        {/* Towers */}
        <TowerLayer mode={mode} setEditingTower={setEditingTower} setTempFreq={setTempFreq} />

        {/* ========== LINKS ========== */}
        <LinkLayer />

        {/* Fresnel polygons for active links */}
        <FresnelPolygons fresnelPolygons={fresnelPolygons} />
      </MapContainer>

      {/* Simple toast notifications (mimics Ant Design message) */}
      {toast && (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            right: 16,
            top: 16,
            zIndex: 20000,
            background: toast.type === "error" ? "#ff4d4f" : "#1890ff",
            color: "white",
            padding: "8px 12px",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            fontWeight: 600,
          }}
        >
          {toast.text}
        </div>
      )}
    </>
  );
}
