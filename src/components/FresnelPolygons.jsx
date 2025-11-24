import { Polygon } from 'react-leaflet';

export default function FresnelPolygons({ fresnelPolygons }) {
  return (
    <>
      {Object.entries(fresnelPolygons).map(([key, polygon]) => (
        <Polygon
          key={`fresnel-${key}`}
          positions={polygon}
          pathOptions={{ color: 'blue', fillOpacity: 0.25, weight: 1 }}
        />
      ))}
    </>
  );
}
