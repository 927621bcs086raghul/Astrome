import { useDispatch, useSelector } from 'react-redux';
import { clearFresnel as clearFresnelAction, removeLink as removeLinkAction, setFresnelPolygon as setFresnelAction } from '../store/towersSlice';
import { buildFresnelPolygon } from '../utils/fresnel';
import LinkPolyline from './LinkPolyline';

export default function LinkLayer() {
  const dispatch = useDispatch();
  const towers = useSelector((s) => s.towers.towers);
  const links = useSelector((s) => s.towers.links);
  const fresnelPolygons = useSelector((s) => s.towers.fresnel);
  const placeCache = useSelector((s) => s.towers.places);

  const handleLinkClick = (link) => {
    const key = `${link.fromId}-${link.toId}`;
    if (fresnelPolygons[key]) {
      dispatch(clearFresnelAction(key));
      return;
    }

    const A = towers.find((t) => t.id === link.fromId);
    const B = towers.find((t) => t.id === link.toId);
    if (!A || !B) return;
    const freq = (A.freq + B.freq) / 2;
    try {
      const polygon = buildFresnelPolygon(A, B, freq);
      
      // Log distance and Fresnel details
      const { haversine } = require('../utils/fresnel');
      const distance = haversine(A.lat, A.lng, B.lat, B.lng);
      console.log(`📡 Transmitter (${A.id}): ${A.lat.toFixed(6)}, ${A.lng.toFixed(6)}`);
      console.log(`📡 Receiver (${B.id}): ${B.lat.toFixed(6)}, ${B.lng.toFixed(6)}`);
      console.log(`📏 Distance: ${distance.toFixed(2)} km`);
      console.log(`📊 Fresnel Polygon:`, {
        points: polygon.length,
        minLat: Math.min(...polygon.map(p => p[0])).toFixed(6),
        maxLat: Math.max(...polygon.map(p => p[0])).toFixed(6),
        minLng: Math.min(...polygon.map(p => p[1])).toFixed(6),
        maxLng: Math.max(...polygon.map(p => p[1])).toFixed(6),
        samplePoints: polygon.slice(0, 5).map(p => `[${p[0].toFixed(5)}, ${p[1].toFixed(5)}]`)
      });
      
      dispatch(setFresnelAction({ key, polygon }));
    } catch (e) {
      console.log('Error building fresnel polygon in LinkLayer', e);
    }

    // Also dispatch saga to fetch elevations and place names
    dispatch({ type: 'towers/fetchFresnel', payload: { fromId: link.fromId, toId: link.toId } });
  };

  const handleDelete = (link) => {
    dispatch(removeLinkAction({ fromId: link.fromId, toId: link.toId }));
    dispatch(clearFresnelAction(`${link.fromId}-${link.toId}`));
    dispatch(clearFresnelAction(`${link.toId}-${link.fromId}`));
  };

  return (
    <>
      {links.map((link, index) => {
        const A = towers.find((t) => t.id === link.fromId);
        const B = towers.find((t) => t.id === link.toId);
        if (!A || !B) return null;
        return (
          <LinkPolyline
            key={index}
            A={A}
            B={B}
            link={link}
            index={index}
            placeCache={placeCache}
            handleLinkClick={handleLinkClick}
            onDelete={handleDelete}
          />
        );
      })}
    </>
  );
}
