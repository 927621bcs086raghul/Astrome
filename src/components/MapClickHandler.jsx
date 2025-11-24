import { useMapEvents } from 'react-leaflet';

export default function MapClickHandler({ mode, onClick }) {
  useMapEvents({
    click(e) {
      if (mode === 'place') onClick(e.latlng);
    },
  });
  return null;
}
