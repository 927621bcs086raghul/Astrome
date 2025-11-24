import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addLink as addLinkAction, removeTower as removeTowerAction } from '../store/towersSlice';
import TowerMarker from './TowerMarker';

export default function TowerLayer({ mode, setEditingTower, setTempFreq }) {
  const dispatch = useDispatch();
  const towers = useSelector((s) => s.towers.towers);
  const links = useSelector((s) => s.towers.links);
  const placeCache = useSelector((s) => s.towers.places);

  const [pendingLinkStart, setPendingLinkStart] = useState(null);

  const handleTowerClick = (tower) => {
    if (mode !== 'link') return;

    if (!pendingLinkStart) {
      setPendingLinkStart(tower);
    } else {
      // create link if valid
      if (pendingLinkStart.id === tower.id) {
        setPendingLinkStart(null);
        return;
      }
      if (pendingLinkStart.freq !== tower.freq) {
        alert('Frequencies must match to create link');
        setPendingLinkStart(null);
        return;
      }
      const exists = links.find(
        (lnk) =>
          (lnk.fromId === pendingLinkStart.id && lnk.toId === tower.id) ||
          (lnk.fromId === tower.id && lnk.toId === pendingLinkStart.id)
      );
      if (exists) {
        alert('Link already exists');
        setPendingLinkStart(null);
        return;
      }
      dispatch(addLinkAction({ fromId: pendingLinkStart.id, toId: tower.id }));
      setPendingLinkStart(null);
    }
  };

  const deleteTowerById = (id) => {
    const hasLinks = links.some((lnk) => lnk.fromId === id || lnk.toId === id);
    if (hasLinks) {
      alert('Cannot delete tower — it is part of an existing link.');
      return;
    }
    dispatch(removeTowerAction(id));
  };

  return (
    <>
      {towers.map((tower) => (
        <TowerMarker
          key={tower.id}
          tower={tower}
          links={links}
          placeCache={placeCache}
          handleTowerClick={handleTowerClick}
          deleteTowerById={deleteTowerById}
          setEditingTower={setEditingTower}
          setTempFreq={setTempFreq}
        />
      ))}
    </>
  );
}
