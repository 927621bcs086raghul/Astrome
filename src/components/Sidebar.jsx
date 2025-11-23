export default function Sidebar({ mode, setMode }) {
  const buttons = [
    { key: "place", label: "Place Marker" },
    { key: "distance", label: "Distance Mode" },
    { key: "link", label: "Link Mode" },
    { key: "clear", label: "Clear Map" },
  ];

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold mb-4">RF Link Planner</h1>

      {buttons.map((btn) => (
        <button
          key={btn.key}
          onClick={() => setMode(btn.key)}
          className={`w-full py-2 rounded-lg border 
            ${mode === btn.key ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600"}
          `}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
