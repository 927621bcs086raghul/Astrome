import L from "leaflet";
import { useEffect } from "react";

let mapInstance = null;

export default function MapView({ onMapClick }) {
  useEffect(() => {
    if (!mapInstance) {
      mapInstance = L.map("map", {
        center: [20.5937, 78.9629], // India center
        zoom: 5,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(mapInstance);

      mapInstance.on("click", (e) => {
        onMapClick(e.latlng);
      });
    }
  }, []);

  return <div id="map" className="w-full h-full"></div>;
}
