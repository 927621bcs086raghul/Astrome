import { useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMapEvents,
} from "react-leaflet";

// Tower Icon


// =============================
// Distance Calculation (KM)
// =============================
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// =============================
// Fresnel Zone (meters)
// =============================
const fresnelZone = (distanceKm, freqGHz) => {
  const d1 = distanceKm / 2;
  const d2 = distanceKm / 2;
  return 17.32 * Math.sqrt((d1 * d2) / (freqGHz * distanceKm));
};

// =============================
// Map Click Handler Component
// =============================
function MapClickHandler({ mode, onClick }) {
  useMapEvents({
    click(e) {
      if (mode === "place") {
        onClick(e.latlng);
      }
    },
  });
  return null;
}

// =============================
// MAIN MAP COMPONENT
// =============================
export default function RFMap({
  mode,
  towers,
  setTowers,
  links,
  setLinks,
}) {
  const [pendingLinkStart, setPendingLinkStart] = useState(null);

  const [editingTower, setEditingTower] = useState(null);
  const [tempFreq, setTempFreq] = useState("");

  // Add Tower
  const addTower = (latlng) => {
    const { lat, lng } = latlng;

    const newTower = {
      id: Date.now(),
      lat,
      lng,
      freq: 5,
    };

    setTowers((prev) => [...prev, newTower]);
  };

  // Delete Tower
  const deleteTowerById = (id) => {
    setTowers((prev) => prev.filter((t) => t.id !== id));
    setLinks((prev) => prev.filter((lnk) => lnk.fromId !== id && lnk.toId !== id));
  };

  // Update Tower
  const updateTowerById = (id, data) => {
    setTowers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...data } : t))
    );
  };

  // Create Link
  const addLink = (a, b) => {
    if (a.id === b.id) return alert("Cannot link same tower");

    if (a.freq !== b.freq)
      return alert("Frequencies must match to create link");

    const exists = links.find(
      (lnk) =>
        (lnk.fromId === a.id && lnk.toId === b.id) ||
        (lnk.fromId === b.id && lnk.toId === a.id)
    );
    if (exists) return alert("Link already exists");

    setLinks((prev) => [...prev, { fromId: a.id, toId: b.id }]);
  };

  // Tower Click Event
  const handleTowerClick = (tower) => {
    if (mode !== "link") return;

    if (!pendingLinkStart) {
      setPendingLinkStart(tower);
    } else {
      addLink(pendingLinkStart, tower);
      setPendingLinkStart(null);
    }
  };

  return (
    <>
      {/* ========== Edit Frequency Modal ========== */}
      {editingTower && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white text-black rounded-lg p-6 w-80">
            <h2 className="text-xl font-semibold mb-3">Edit Frequency</h2>

            <input
              type="number"
              className="w-full border p-2 rounded"
              value={tempFreq}
              onChange={(e) => setTempFreq(e.target.value)}
            />

            <div className="flex justify-end gap-3 mt-4">
              <button
                className="px-4 py-2 bg-gray-300 rounded"
                onClick={() => setEditingTower(null)}
              >
                Cancel
              </button>

              <button
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={() => {
                  updateTowerById(editingTower.id, {
                    freq: Number(tempFreq),
                  });
                  setEditingTower(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== MAP ========== */}
      <MapContainer
        center={[12.97, 77.59]}
        zoom={6}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Click to add tower */}
        <MapClickHandler
          mode={mode}
          onClick={(latlng) => addTower(latlng)}
        />

        {/* Towers */}
        {towers.map((tower) => (
          <Marker
            key={tower.id}
            position={[tower.lat, tower.lng]}
            eventHandlers={{
              click: () => handleTowerClick(tower),
              contextmenu: () => deleteTowerById(tower.id),
            }}
          >
            <Popup>
              <div className="text-black">
                <b>Lat:</b> {tower.lat.toFixed(5)} <br />
                <b>Lng:</b> {tower.lng.toFixed(5)} <br />
                <b>Freq:</b> {tower.freq} GHz <br />

                <button
                  className="mt-2 bg-blue-600 text-white px-3 py-1 rounded"
                  onClick={() => {
                    setEditingTower(tower);
                    setTempFreq(tower.freq);
                  }}
                >
                  Edit Frequency
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* ========== LINKS ========== */}
        {links.map((link, index) => {
          const A = towers.find((t) => t.id === link.fromId);
          const B = towers.find((t) => t.id === link.toId);
          if (!A || !B) return null;

          const dist = haversine(A.lat, A.lng, B.lat, B.lng);
          const freq = (A.freq + B.freq) / 2;
          const fresnel = fresnelZone(dist, freq);

          return (
            <Polyline
              key={index}
              positions={[
                [A.lat, A.lng],
                [B.lat, B.lng],
              ]}
              color="red"
              weight={4}
            >
              <Popup>
                <div className="text-black">
                  <b>Distance:</b> {dist.toFixed(2)} km <br />
                  <b>Frequency:</b> {freq} GHz <br />
                  <b>Fresnel F1:</b> {fresnel.toFixed(2)} m <br /><br />

                  <button
                    className="bg-red-600 text-white px-3 py-1 rounded"
                    onClick={() =>
                      setLinks((prev) =>
                        prev.filter(
                          (l) =>
                            !(
                              l.fromId === link.fromId &&
                              l.toId === link.toId
                            )
                        )
                      )
                    }
                  >
                    Delete Link
                  </button>
                </div>
              </Popup>
            </Polyline>
          );
        })}
      </MapContainer>
    </>
  );
}
