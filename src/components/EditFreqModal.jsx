export default function EditFreqModal({ editingTower, tempFreq, setTempFreq, setEditingTower, updateTowerById }) {
  if (!editingTower) return null;

  return (
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
              updateTowerById(editingTower.id, { freq: Number(tempFreq) });
              setEditingTower(null);
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
