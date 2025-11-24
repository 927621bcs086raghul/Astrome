import { Polyline, Popup, Tooltip } from 'react-leaflet';
import { fresnelZone, haversine } from '../utils/fresnel';

export default function LinkPolyline({ A, B, link, index, placeCache, handleLinkClick, onDelete }) {
  if (!A || !B) return null;
  const dist = haversine(A.lat, A.lng, B.lat, B.lng);
  const freq = (A.freq + B.freq) / 2;
  const fresnel = fresnelZone(dist, freq);

  const keyA = `${A.lat.toFixed(6)},${A.lng.toFixed(6)}`;
  const keyB = `${B.lat.toFixed(6)},${B.lng.toFixed(6)}`;
  const nameA = placeCache[keyA] || `${A.id} (${A.lat.toFixed(5)}, ${A.lng.toFixed(5)})`;
  const nameB = placeCache[keyB] || `${B.id} (${B.lat.toFixed(5)}, ${B.lng.toFixed(5)})`;

  return (
    <Polyline
      key={index}
      positions={[[A.lat, A.lng], [B.lat, B.lng]]}
      color="red"
      weight={4}
      eventHandlers={{ click: () => handleLinkClick(link) }}
    >
      <Popup>
        <div className="text-black">
          <>
            <b>From:</b> {nameA} <br />
            <b>To:</b> {nameB} <br />
            <br />

            <b>Distance:</b> {dist.toFixed(2)} km <br />
            <b>Frequency:</b> {freq} GHz <br />
            <b>Fresnel F1:</b> {fresnel.toFixed(2)} m <br /><br />

            <button
              className="bg-red-600 text-white px-3 py-1 rounded"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(link);
              }}
            >
              Delete Link
            </button>
          </>
        </div>
      </Popup>
      <Tooltip permanent={false} direction="center">
        {`${nameA} → ${nameB} · ${dist.toFixed(2)} km @ ${freq} GHz`}
      </Tooltip>
    </Polyline>
  );
}
