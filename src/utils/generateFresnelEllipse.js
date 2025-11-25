import L from "leaflet";

// Generate simplified Fresnel ellipse
export function generateFresnelEllipse(pointA, pointB, freqMHz, numPoints = 180) {
  console.log('Generating Fresnel ellipse between', pointA, pointB, 'at', freqMHz, 'MHz');
  const A = L.latLng(pointA);
  const B = L.latLng(pointB);

  // Distance AB (meters)
  const d = A.distanceTo(B);

  // Wavelength λ
  const C = 3e8;
  const f = freqMHz * 1e6;
  const lambda = C / f;

  // First Fresnel radius at midpoint (semi-minor axis)
  const minor = Math.sqrt((lambda * d) / 4);

  // Semi-major axis
  const major = d / 2;

  // Midpoint
  const mid = {
    lat: (A.lat + B.lat) / 2,
    lng: (A.lng + B.lng) / 2,
  };

  // Angle of AB in meters (correct projection)
  const angleRad = Math.atan2(
    (B.lat - A.lat) * 111320,
    (B.lng - A.lng) * 111320 * Math.cos((A.lat * Math.PI) / 180)
  );

  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  const points = [];

  for (let i = 0; i < numPoints; i++) {
    const theta = (2 * Math.PI * i) / numPoints;

    // Ellipse before rotation
    const x = major * Math.cos(theta);
    const y = minor * Math.sin(theta);

    // Rotate ellipse
    const xr = x * cos - y * sin;
    const yr = x * sin + y * cos;

    // Convert meters → lat/lng
    const lat = mid.lat + yr / 111320;
    const lng =
      mid.lng + xr / (111320 * Math.cos((mid.lat * Math.PI) / 180));

    points.push([lat, lng]);
  }

  return points;
}
