import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  towers: [],
  links: [],
  fresnel: {}, // key -> polygon
  elevations: {},
  places: {},
};

const slice = createSlice({
  name: 'towers',
  initialState,
  reducers: {
    setTowers(state, action) {
      state.towers = action.payload;
    },
    addTower(state, action) {
      state.towers.push(action.payload);
    },
    removeTower(state, action) {
      state.towers = state.towers.filter((t) => t.id !== action.payload);
      // also remove links pointing to tower
      state.links = state.links.filter((l) => l.fromId !== action.payload && l.toId !== action.payload);
      // remove fresnel entries referencing this tower
      Object.keys(state.fresnel).forEach((k) => {
        const [a, b] = k.split('-').map(Number);
        if (a === action.payload || b === action.payload) delete state.fresnel[k];
      });
    },
    updateTower(state, action) {
      const { id, data } = action.payload;
      state.towers = state.towers.map((t) => (t.id === id ? { ...t, ...data } : t));
    },
    addLink(state, action) {
      state.links.push(action.payload);
    },
    removeLink(state, action) {
      const { fromId, toId } = action.payload;
      state.links = state.links.filter(
        (l) => !(l.fromId === fromId && l.toId === toId)
      );
      // remove fresnel polygons for this link
      delete state.fresnel[`${fromId}-${toId}`];
      delete state.fresnel[`${toId}-${fromId}`];
    },
    setFresnelPolygon(state, action) {
      const { key, polygon } = action.payload;
      state.fresnel[key] = polygon;
    },
    clearFresnel(state, action) {
      const key = action.payload;
      if (state.fresnel[key]) delete state.fresnel[key];
    },
    setElevations(state, action) {
      console.log('Setting elevations in slice');
      const { key, results } = action.payload;
      state.elevations[key] = results;
      console.log(state.elevations);
    },
    setPlaceName(state, action) {
      const { key, name } = action.payload;
      state.places[key] = name;
    },
  },
});

export const {
  setTowers,
  addTower,
  removeTower,
  updateTower,
  addLink,
  removeLink,
  setFresnelPolygon,
  clearFresnel,
  setElevations,
  setPlaceName,
} = slice.actions;

export default slice.reducer;
