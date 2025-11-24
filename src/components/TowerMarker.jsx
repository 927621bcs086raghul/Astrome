import { Marker, Popup } from 'react-leaflet';

export default function TowerMarker({ tower, links, placeCache, handleTowerClick, deleteTowerById, setEditingTower, setTempFreq }) {
  const linked = links.some((l) => l.fromId === tower.id || l.toId === tower.id);
  const key = `${tower.lat.toFixed(6)},${tower.lng.toFixed(6)}`;
  const name = placeCache[key] || `${tower.id} (${tower.lat.toFixed(5)}, ${tower.lng.toFixed(5)})`;

  return (
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

          <div className="mt-2 flex gap-2">
            {!linked && (
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
            )}
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
      </Popup>
    </Marker>
  );
}
