export default function FrequencyModal({ visible, onClose, tower, onSave }) {
  if (!visible || !tower) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white rounded p-6 w-80 space-y-4">

        <h2 className="text-xl font-bold">Edit Frequency</h2>

        <div>
          <label className="block text-sm font-medium mb-2">Frequency (GHz)</label>
          <input
            type="number"
            min="1"
            step="0.1"
            defaultValue={tower.freq}
            id="freqInput"
            className="border p-2 w-full rounded"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              const newFreq = parseFloat(document.getElementById("freqInput").value);
              onSave(newFreq);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
