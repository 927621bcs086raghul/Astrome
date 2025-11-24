// src/App.jsx
import { useState } from "react";
import RFMap from "./components/RFMap"; // make sure this exists
import Sidebar from "./components/Sidebar"; // make sure this exists

export default function App() {
  // mode: 'place' | 'link' | 'distance' etc.
  const [mode, setMode] = useState("place");

  // towers: [{ id, lat, lng, freq }]
  const [towers, setTowers] = useState([]);

  // links: [{ fromId, toId }]
  const [links, setLinks] = useState([]);

  // Helper to add a tower programmatically (not required if RFMap adds on map click)
  const addTower = ({ lat, lng, freq = 5 }) => {
    const newTower = {
      id: Date.now() + Math.floor(Math.random() * 1000), // unique id
      lat,
      lng,
      freq,
    };
    setTowers((t) => [...t, newTower]);
    return newTower;
  };

  // Delete tower by id (safe; removes related links)
  const deleteTowerById = (id) => {
    setTowers((prev) => prev.filter((t) => t.id !== id));
    setLinks((prev) => prev.filter((l) => l.fromId !== id && l.toId !== id));
  };

  // Update tower fields by id (e.g., frequency)
  const updateTowerById = (id, patch) => {
    setTowers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  // Add link (avoid duplicates and self-links)
  const addLink = ({ fromId, toId }) => {
    if (fromId === toId) return;
    const exists = links.some(
      (l) => (l.fromId === fromId && l.toId === toId) || (l.fromId === toId && l.toId === fromId)
    );
    if (exists) return;
    setLinks((prev) => [...prev, { fromId, toId }]);
  };

  // Remove a link by index or by (fromId,toId)
  const removeLink = (predicate) => {
    // predicate can be a function or an index number
    setLinks((prev) => {
      if (typeof predicate === "number") {
        return prev.filter((_, i) => i !== predicate);
      } else {
        return prev.filter((l) => !predicate(l));
      }
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar area */}
      <div className="w-64 bg-gray-900 text-white p-4 overflow-auto">
        {/* If you used the earlier Sidebar component, it expects (mode, setMode) */}
        <Sidebar mode={mode} setMode={setMode} />

        {/* Sidebar controls are above; removed debug counters and quick-add button */}
      </div>

      {/* Map area */}
      <div className="flex-1">
        <RFMap
          mode={mode}
          towers={towers}
          setTowers={setTowers}
          links={links}
          setLinks={setLinks}
          addLink={addLink}
          deleteTowerById={deleteTowerById}
          updateTowerById={updateTowerById}
          removeLink={removeLink}
        />
      </div>
    </div>
  );
}
