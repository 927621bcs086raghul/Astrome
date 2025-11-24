// Fresnel helpers: haversine, meters-per-degree, fresnel radius, and polygon builder
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const metersPerDegLat = 111320;
export const metersPerDegLon = (lat) => Math.abs(Math.cos((lat * Math.PI) / 180) * 111320);

export const interpolateLatLng = (A, B, t) => ({
  lat: A.lat + (B.lat - A.lat) * t,
  lng: A.lng + (B.lng - A.lng) * t,
});

// Fresnel F1 radius at distance x (meters) from point A along a total path D (meters)
export function fresnelRadiusAt(D, x, freqGHz) {
  if (D <= 0) return 0;
  if (x <= 0 || x >= D) return 0;
  const freqHz = freqGHz * 1e9;
  const c = 3e8;
  const lambda = c / freqHz;
  return Math.sqrt((lambda * x * (D - x)) / D);
}

// Midpoint Fresnel radius (meters) given distance in km and freq in GHz
export function fresnelZone(distanceKm, freqGHz) {
  const D = distanceKm * 1000;
  if (D <= 0) return 0;
  const x = D / 2;
  return fresnelRadiusAt(D, x, freqGHz);
}

// Build a true Fresnel polygon (ellipse-like) around link A->B
// Options: samples (approx boundary points per side), maxSamples/minSamples
export function buildFresnelPolygon(A, B, freqGHz, options = {}) {
  const { samples: optSamples } = options;

  if (!A || !B) return [];
  if (!Number.isFinite(A.lat) || !Number.isFinite(A.lng) || !Number.isFinite(B.lat) || !Number.isFinite(B.lng)) return [];

  const distKm = haversine(A.lat, A.lng, B.lat, B.lng);
  const D = distKm * 1000;
  if (D <= 0) return [];

  const midLat = (A.lat + B.lat) / 2;
  let dEast = (B.lng - A.lng) * metersPerDegLon(midLat);
  let dNorth = (B.lat - A.lat) * metersPerDegLat;

  const L = Math.sqrt(dEast * dEast + dNorth * dNorth);
  if (!Number.isFinite(L) || L === 0) return [];

  // adaptive sampling: more samples for longer links, clamped
  const minSamples = 48;
  const maxSamples = 360;
  const densityPerKm = 60; // samples per km (approx)
  const autoSamples = Math.round((L / 1000) * densityPerKm) + 36;
  const samples = optSamples && Number.isFinite(optSamples) ? Math.max(24, Math.min(maxSamples, Math.round(optSamples))) : Math.max(minSamples, Math.min(maxSamples, autoSamples));

  // unit vectors (east,north)
  const ux = dEast / L;
  const uy = dNorth / L;
  const px = -uy; // perpendicular east
  const py = ux; // perpendicular north

  const points = [];
  const freqHz = freqGHz * 1e9;
  const c = 3e8;
  const lambda = c / freqHz;

  let mpdLon = metersPerDegLon(midLat);
  if (!Number.isFinite(mpdLon) || mpdLon === 0) mpdLon = 111320;

  // left side A -> B
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const d = t * L;
    const r = fresnelRadiusAt(D, d, freqGHz);
    const bx = ux * d;
    const by = uy * d;
    const baseLat = A.lat + by / metersPerDegLat;
    const baseLng = A.lng + bx / mpdLon;
    const leftLat = baseLat + (py * r) / metersPerDegLat;
    const leftLng = baseLng + (px * r) / mpdLon;
    if (Number.isFinite(leftLat) && Number.isFinite(leftLng)) points.push([leftLat, leftLng]);
  }

  // right side B -> A
  for (let i = samples; i >= 0; i--) {
    const t = i / samples;
    const d = t * L;
    const r = fresnelRadiusAt(D, d, freqGHz);
    const bx = ux * d;
    const by = uy * d;
    const baseLat = A.lat + by / metersPerDegLat;
    const baseLng = A.lng + bx / mpdLon;
    const rightLat = baseLat - (py * r) / metersPerDegLat;
    const rightLng = baseLng - (px * r) / mpdLon;
    if (Number.isFinite(rightLat) && Number.isFinite(rightLng)) points.push([rightLat, rightLng]);
  }

  // require a valid polygon
  if (points.length < 3) return [];

  // close polygon explicitly (leaflet will close it but repeating first point avoids oddities)
  points.push(points[0]);

  return points;
}
