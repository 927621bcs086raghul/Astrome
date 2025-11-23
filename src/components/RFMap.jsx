import { useEffect, useState } from "react";
import {
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import { useDispatch, useSelector } from 'react-redux';
import {
  addLink as addLinkAction,
  addTower as addTowerAction,
  clearFresnel as clearFresnelAction,
  removeLink as removeLinkAction,
  removeTower as removeTowerAction,
  setPlaceName as setPlaceNameAction,
  updateTower as updateTowerAction,
} from '../store/towersSlice';

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

// Convert degrees delta to meters approximation and back
const metersPerDegLat = 111320; // approx
const metersPerDegLon = (lat) => Math.abs(Math.cos((lat * Math.PI) / 180) * 111320);

const interpolateLatLng = (A, B, t) => {
  return {
    lat: A.lat + (B.lat - A.lat) * t,
    lng: A.lng + (B.lng - A.lng) * t,
  };
};

// Build an approximate Fresnel polygon (simple envelope) along the link
const buildFresnelPolygon = (A, B, freqGHz, samples = 50) => {
  const distKm = haversine(A.lat, A.lng, B.lat, B.lng);
  const D = distKm * 1000; // meters
  if (D === 0) return [];

  const fHz = freqGHz * 1e9;
  const c = 3e8;
  const lambda = c / fHz;

  // compute vector in meters
  const midLat = (A.lat + B.lat) / 2;
  const dLat = (B.lat - A.lat) * metersPerDegLat; // meters north
  const dLon = (B.lng - A.lng) * metersPerDegLon(midLat); // meters east

  const pointsLeft = [];
  const pointsRight = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const pt = interpolateLatLng(A, B, t);

    const d1 = D * t;
    const d2 = D * (1 - t);
    const r = Math.sqrt((lambda * d1 * d2) / (d1 + d2 || 1)); // meters

    // direction vector (east, north) at this point
    const vx = dLon; // east total
    const vy = dLat; // north total

    // perpendicular vector (east, north)
    let px = -vy;
    let py = vx;
    const plen = Math.sqrt(px * px + py * py) || 1;
    px /= plen;
    py /= plen;

    // scale perp vector by r (meters)
    const offEast = px * r;
    const offNorth = py * r;

    const latLeft = pt.lat + offNorth / metersPerDegLat;
    const lngLeft = pt.lng + offEast / metersPerDegLon(pt.lat);

    const latRight = pt.lat - offNorth / metersPerDegLat;
    const lngRight = pt.lng - offEast / metersPerDegLon(pt.lat);

    pointsLeft.push([latLeft, lngLeft]);
    pointsRight.push([latRight, lngRight]);
  }

  // polygon: left side then reversed right side
  return [...pointsLeft, ...pointsRight.reverse()];
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
export default function RFMap({ mode }) {
  const dispatch = useDispatch();
  const towers = useSelector((s) => s.towers.towers);
  const links = useSelector((s) => s.towers.links);
  const fresnelPolygons = useSelector((s) => s.towers.fresnel);
  const placeCache = useSelector((s) => s.towers.places);

  const [pendingLinkStart, setPendingLinkStart] = useState(null);
  const [editingTower, setEditingTower] = useState(null);
  const [tempFreq, setTempFreq] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = (text, type = "info", ms = 3000) => {
    setToast({ text, type });
    setTimeout(() => setToast(null), ms);
  };

  // remove fresnel polygon entries for a given pair (both directions)
  const removeFresnelForIds = (idA, idB) => {
    dispatch(clearFresnelAction(`${idA}-${idB}`));
    dispatch(clearFresnelAction(`${idB}-${idA}`));
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
      if (!res.ok) return null;
      const data = await res.json();
      const name = data.display_name || null;
      dispatch(setPlaceNameAction({ key, name }));
      return name;
    } catch (e) {
      return null;
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

  // Add Tower
  const addTower = (latlng) => {
    const { lat, lng } = latlng;

    const newTower = {
      id: Date.now(),
      lat,
      lng,
      freq: 5,
    };

    dispatch(addTowerAction(newTower));
  };

  // Delete Tower
  const deleteTowerById = (id) => {
    // Prevent deleting if tower is part of any link
    const hasLinks = links.some((lnk) => lnk.fromId === id || lnk.toId === id);
    if (hasLinks) {
      showToast("Cannot delete tower — it is part of an existing link.", "error");
      return;
    }
    dispatch(removeTowerAction(id));
  };

  // Update Tower
  const updateTowerById = (id, data) => {
    dispatch(updateTowerAction({ id, data }));
  };

  // Create Link
  const addLink = (a, b) => {
    if (a.id === b.id) return alert("Cannot link same tower");
    if (a.freq !== b.freq) return alert("Frequencies must match to create link");
    const exists = links.find(
      (lnk) =>
        (lnk.fromId === a.id && lnk.toId === b.id) ||
        (lnk.fromId === b.id && lnk.toId === a.id)
    );
    if (exists) return alert("Link already exists");
    dispatch(addLinkAction({ fromId: a.id, toId: b.id }));
  };

  // Handle link click: compute / toggle fresnel polygon and fetch elevations
  const handleLinkClick = (link) => {
    const key = `${link.fromId}-${link.toId}`;
    // toggle off if already shown
    if (fresnelPolygons[key]) {
      dispatch({ type: 'towers/clearFresnel', payload: key });
      return;
    }
    // dispatch a fetch for fresnel (saga will compute polygon and fetch elevations/places)
    dispatch({ type: 'towers/fetchFresnel', payload: { fromId: link.fromId, toId: link.toId } });
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
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center"
          style={{ zIndex: 10000 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white text-black rounded-lg p-6 w-80">
            <h2 className="text-xl font-semibold mb-3">Edit Frequency</h2>

            <label htmlFor="tempFreqInput" className="block text-sm font-medium mb-2">Frequency (GHz)</label>
            <input
              id="tempFreqInput"
              name="frequency"
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
                {(() => {
                  const linked = links.some((l) => l.fromId === tower.id || l.toId === tower.id);
                  return (
                    <div className="text-black">
                      <b>Lat:</b> {tower.lat.toFixed(5)} <br />
                      <b>Lng:</b> {tower.lng.toFixed(5)} <br />
                      <b>Freq:</b> {tower.freq} GHz <br />

                      <div className="mt-2 flex gap-2">
                        <button
                          className="bg-blue-600 text-white px-3 py-1 rounded"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingTower(tower);
                            setTempFreq(tower.freq);
                          }}
                        >
                          Edit Frequency
                        </button>
                        {!linked && (
                          <button
                            className="bg-red-600 text-white px-3 py-1 rounded"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              deleteTowerById(tower.id);
                            }}
                          >
                            Delete Tower
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
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
              eventHandlers={{
                click: () => handleLinkClick(link),
              }}
            >
                  <Popup>
                    <div className="text-black">
                      {(() => {
                        const keyA = `${A.lat.toFixed(6)},${A.lng.toFixed(6)}`;
                        const keyB = `${B.lat.toFixed(6)},${B.lng.toFixed(6)}`;
                        const nameA = placeCache[keyA] || `${A.id} (${A.lat.toFixed(5)}, ${A.lng.toFixed(5)})`;
                        const nameB = placeCache[keyB] || `${B.id} (${B.lat.toFixed(5)}, ${B.lng.toFixed(5)})`;
                        return (
                          <>
                            <b>From:</b> {nameA} <br />
                            <b>To:</b> {nameB} <br />
                            <br />
                          </>
                        );
                      })()}

                      <b>Distance:</b> {dist.toFixed(2)} km <br />
                      <b>Frequency:</b> {freq} GHz <br />
                      <b>Fresnel F1:</b> {fresnel.toFixed(2)} m <br /><br />

                      <button
                        className="bg-red-600 text-white px-3 py-1 rounded"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dispatch(removeLinkAction({ fromId: link.fromId, toId: link.toId }));
                          // remove any related fresnel polygon
                          removeFresnelForIds(link.fromId, link.toId);
                        }}
                      >
                        Delete Link
                      </button>
                    </div>
                  </Popup>
                  <Tooltip permanent={false} direction="center">
                    {(() => {
                      const keyA = `${A.lat.toFixed(6)},${A.lng.toFixed(6)}`;
                      const keyB = `${B.lat.toFixed(6)},${B.lng.toFixed(6)}`;
                      const nameA = placeCache[keyA] || `(${A.lat.toFixed(3)}, ${A.lng.toFixed(3)})`;
                      const nameB = placeCache[keyB] || `(${B.lat.toFixed(3)}, ${B.lng.toFixed(3)})`;
                      return `${nameA} → ${nameB} · ${dist.toFixed(2)} km @ ${freq} GHz`;
                    })()}
                  </Tooltip>
            </Polyline>
          );
        })}

        {/* Fresnel polygons for active links */}
        {Object.entries(fresnelPolygons).map(([key, polygon]) => (
          <Polygon
            key={`fresnel-${key}`}
            positions={polygon}
            pathOptions={{ color: "blue", fillOpacity: 0.25, weight: 1 }}
          />
        ))}
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
