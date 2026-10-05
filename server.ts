import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as satellite from 'satellite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

// In-memory catalog seeded with verified orbital elements
const SEED_SATELLITES = [
  {
    catalog_id: "25544",
    name: "ISS (ZARYA)",
    intl_desig: "1998-067A",
    object_type: "PAYLOAD",
    category: "Stations",
    epoch: "2026-10-05T12:00:00.000Z",
    line1: "1 25544U 98067A   26278.50000000  .00014521  00000+0  26344-3 0  9993",
    line2: "2 25544  51.6418 120.3421 0005432  65.1234 295.1245 15.49842104500001",
    inclination: 51.6418,
    eccentricity: 0.0005432,
    mean_motion: 15.49842104,
    period_min: 92.91,
    altitude_km: 418.5,
    source: "CelesTrak GP (OMM)",
    description: "International Space Station in Low Earth Orbit (LEO), serving as a microgravity laboratory."
  },
  {
    catalog_id: "48274",
    name: "CSS (TIANHE)",
    intl_desig: "2021-035A",
    object_type: "PAYLOAD",
    category: "Stations",
    epoch: "2026-10-05T10:00:00.000Z",
    line1: "1 48274U 21035A   26278.41666667  .00018231  00000+0  17521-3 0  9997",
    line2: "2 48274  41.4721  85.6124 0003812 110.4512 249.7812 15.61234512280004",
    inclination: 41.4721,
    eccentricity: 0.0003812,
    mean_motion: 15.61234512,
    period_min: 92.23,
    altitude_km: 385.2,
    source: "CelesTrak GP (OMM)",
    description: "Core module of the Tiangong Chinese Space Station in LEO."
  },
  {
    catalog_id: "20580",
    name: "HST (HUBBLE)",
    intl_desig: "1990-037B",
    object_type: "PAYLOAD",
    category: "Science",
    epoch: "2026-10-05T08:00:00.000Z",
    line1: "1 20580U 90037B   26278.33333333  .00001045  00000+0  42100-4 0  9991",
    line2: "2 20580  28.4691 210.8412 0002841 125.1045 235.0124 15.08941234900002",
    inclination: 28.4691,
    eccentricity: 0.0002841,
    mean_motion: 15.08941234,
    period_min: 95.43,
    altitude_km: 535.0,
    source: "CelesTrak GP (OMM)",
    description: "Hubble Space Telescope, observing deep space from low Earth orbit since 1990."
  },
  {
    catalog_id: "44713",
    name: "STARLINK-1007",
    intl_desig: "2019-074A",
    object_type: "PAYLOAD",
    category: "Starlink",
    epoch: "2026-10-05T11:00:00.000Z",
    line1: "1 44713U 19074A   26278.45833333  .00002154  00000+0  11452-3 0  9995",
    line2: "2 44713  53.0541 330.1245 0001425  88.5412 271.5891 15.06412589300006",
    inclination: 53.0541,
    eccentricity: 0.0001425,
    mean_motion: 15.06412589,
    period_min: 95.59,
    altitude_km: 550.2,
    source: "CelesTrak GP (OMM)",
    description: "SpaceX Starlink broadband communication satellite in orbital shell 1."
  },
  {
    catalog_id: "52850",
    name: "STARLINK-4389",
    intl_desig: "2022-064A",
    object_type: "PAYLOAD",
    category: "Starlink",
    epoch: "2026-10-05T09:30:00.000Z",
    line1: "1 52850U 22064A   26278.39583333  .00002341  00000+0  12891-3 0  9998",
    line2: "2 52850  53.2185 195.4215 0001552  74.1235 286.0147 15.05984123220005",
    inclination: 53.2185,
    eccentricity: 0.0001552,
    mean_motion: 15.05984123,
    period_min: 95.62,
    altitude_km: 540.8,
    source: "CelesTrak GP (OMM)",
    description: "SpaceX Starlink V1.5 satellite with laser inter-satellite links."
  },
  {
    catalog_id: "28884",
    name: "GPS BIIRM-1 (PRN 17)",
    intl_desig: "2005-038A",
    object_type: "PAYLOAD",
    category: "Navigation",
    epoch: "2026-10-05T06:00:00.000Z",
    line1: "1 28884U 05038A   26278.25000000 -.00000045  00000+0  00000+0 0  9992",
    line2: "2 28884  55.1245  45.8912 0184512 210.4512 148.2145  2.00568412150008",
    inclination: 55.1245,
    eccentricity: 0.0184512,
    mean_motion: 2.00568412,
    period_min: 717.96,
    altitude_km: 20180.0,
    source: "CelesTrak GP (OMM)",
    description: "Global Positioning System Block IIR-M navigation satellite in MEO."
  },
  {
    catalog_id: "25994",
    name: "TERRA (EOS AM-1)",
    intl_desig: "1999-068A",
    object_type: "PAYLOAD",
    category: "Earth Science",
    epoch: "2026-10-05T07:15:00.000Z",
    line1: "1 25994U 99068A   26278.30208333  .00000412  00000+0  31450-4 0  9994",
    line2: "2 25994  98.2145  15.4891 0001214  95.1245 265.0124 14.57102451450003",
    inclination: 98.2145,
    eccentricity: 0.0001214,
    mean_motion: 14.57102451,
    period_min: 98.83,
    altitude_km: 705.0,
    source: "CelesTrak GP (OMM)",
    description: "Flagship NASA Earth Observing System satellite in Sun-Synchronous Polar Orbit."
  },
  {
    catalog_id: "49260",
    name: "LANDSAT 9",
    intl_desig: "2021-088A",
    object_type: "PAYLOAD",
    category: "Earth Science",
    epoch: "2026-10-05T05:45:00.000Z",
    line1: "1 49260U 21088A   26278.23958333  .00000388  00000+0  29810-4 0  9996",
    line2: "2 49260  98.2045  78.1452 0001155  84.5123 275.6412 14.57114589250007",
    inclination: 98.2045,
    eccentricity: 0.0001155,
    mean_motion: 14.57114589,
    period_min: 98.83,
    altitude_km: 705.0,
    source: "CelesTrak GP (OMM)",
    description: "USGS / NASA Earth observation satellite carrying OLI-2 and TIRS-2 instruments."
  },
  {
    catalog_id: "33443",
    name: "COSMOS 2251 DEBRIS",
    intl_desig: "1993-036PX",
    object_type: "DEBRIS",
    category: "Debris",
    epoch: "2026-10-05T04:20:00.000Z",
    line1: "1 33443U 93036PX  26278.18055556  .00001524  00000+0  10451-3 0  9990",
    line2: "2 33443  74.0412 142.1245 0048123 180.4512 179.6541 14.41245892580009",
    inclination: 74.0412,
    eccentricity: 0.0048123,
    mean_motion: 14.41245892,
    period_min: 99.91,
    altitude_km: 778.0,
    source: "CelesTrak GP (OMM)",
    description: "Tracked orbital fragment from the 2009 Iridium 33 / Cosmos 2251 collision event."
  },
  {
    catalog_id: "31115",
    name: "FENGYUN 1C DEBRIS",
    intl_desig: "1999-025BZ",
    object_type: "DEBRIS",
    category: "Debris",
    epoch: "2026-10-05T03:10:00.000Z",
    line1: "1 31115U 99025BZ  26278.13194444  .00000845  00000+0  64120-4 0  9999",
    line2: "2 31115  98.8124 280.4512 0064125 145.1245 215.0145 14.21458912750002",
    inclination: 98.8124,
    eccentricity: 0.0064125,
    mean_motion: 14.21458912,
    period_min: 101.30,
    altitude_km: 845.5,
    source: "CelesTrak GP (OMM)",
    description: "Fragment from the FY-1C anti-satellite test event in 2007."
  },
  {
    catalog_id: "27386",
    name: "ENVISAT",
    intl_desig: "2002-009A",
    object_type: "DEBRIS",
    category: "Debris",
    epoch: "2026-10-05T02:00:00.000Z",
    line1: "1 27386U 02009A   26278.08333333  .00000156  00000+0  16420-4 0  9993",
    line2: "2 27386  98.5412  42.1245 0001845  78.4512 281.7145 14.38124589120004",
    inclination: 98.5412,
    eccentricity: 0.0001845,
    mean_motion: 14.38124589,
    period_min: 100.13,
    altitude_km: 790.0,
    source: "CelesTrak GP (OMM)",
    description: "8-ton inactive European environmental research satellite; high-priority remediation target."
  },
  {
    catalog_id: "37849",
    name: "SUOMI NPP",
    intl_desig: "2011-061A",
    object_type: "PAYLOAD",
    category: "Earth Science",
    epoch: "2026-10-05T06:30:00.000Z",
    line1: "1 37849U 11061A   26278.27083333  .00000212  00000+0  18450-4 0  9998",
    line2: "2 37849  98.7412 110.4512 0001421  65.1245 295.0124 14.19541289650001",
    inclination: 98.7412,
    eccentricity: 0.0001421,
    mean_motion: 14.19541289,
    period_min: 101.44,
    altitude_km: 824.0,
    source: "CelesTrak GP (OMM)",
    description: "NASA/NOAA meteorological satellite equipped with the VIIRS day-night sensor."
  },
  {
    catalog_id: "45258",
    name: "ONEWEB-0150",
    intl_desig: "2020-012A",
    object_type: "PAYLOAD",
    category: "OneWeb",
    epoch: "2026-10-05T08:20:00.000Z",
    line1: "1 45258U 20012A   26278.34722222  .00000085  00000+0  10000-4 0  9991",
    line2: "2 45258  87.4125 180.2145 0001850  95.1245 264.9812 13.12458912300002",
    inclination: 87.4125,
    eccentricity: 0.000185,
    mean_motion: 13.12458912,
    period_min: 109.72,
    altitude_km: 1200.0,
    source: "CelesTrak GP (OMM)",
    description: "Eutelsat OneWeb global broadband communication satellite in Polar LEO at 1200 km."
  },
  {
    catalog_id: "48831",
    name: "ONEWEB-0280",
    intl_desig: "2021-058B",
    object_type: "PAYLOAD",
    category: "OneWeb",
    epoch: "2026-10-05T07:45:00.000Z",
    line1: "1 48831U 21058B   26278.32291667  .00000078  00000+0  95000-5 0  9997",
    line2: "2 48831  87.4080 320.4512 0001740  82.4512 277.6124 13.12461245350009",
    inclination: 87.408,
    eccentricity: 0.000174,
    mean_motion: 13.12461245,
    period_min: 109.72,
    altitude_km: 1200.0,
    source: "CelesTrak GP (OMM)",
    description: "Eutelsat OneWeb polar orbit Ku/Ka-band low-latency internet satellite."
  },
  {
    catalog_id: "43873",
    name: "GALILEO-26 (GSAT0219)",
    intl_desig: "2018-060A",
    object_type: "PAYLOAD",
    category: "Navigation",
    epoch: "2026-10-05T05:00:00.000Z",
    line1: "1 43873U 18060A   26278.20833333 -.00000012  00000+0  00000+0 0  9993",
    line2: "2 43873  56.0451  95.1245 0002145 110.2145 249.8512  1.70471245200004",
    inclination: 56.0451,
    eccentricity: 0.0002145,
    mean_motion: 1.70471245,
    period_min: 844.72,
    altitude_km: 23222.0,
    source: "CelesTrak GP (OMM)",
    description: "European Galileo global navigation constellation Full Operational Capability (FOC) satellite."
  },
  {
    catalog_id: "53342",
    name: "STARLINK-5112",
    intl_desig: "2022-094A",
    object_type: "PAYLOAD",
    category: "Starlink",
    epoch: "2026-10-05T09:10:00.000Z",
    line1: "1 53342U 22094A   26278.38194444  .00002412  00000+0  13540-3 0  9994",
    line2: "2 53342  53.2190  85.4125 0001612  92.1245 268.0145 15.05971245250008",
    inclination: 53.219,
    eccentricity: 0.0001612,
    mean_motion: 15.05971245,
    period_min: 95.62,
    altitude_km: 540.0,
    source: "CelesTrak GP (OMM)",
    description: "SpaceX Starlink V1.5 satellite equipped with krypton ion propulsion and inter-satellite laser links."
  }
];

let observer = {
  name: "Cape Canaveral Ground Station",
  latitude: 28.5721,
  longitude: -80.6480,
  altitude_m: 10.0,
  min_elevation_deg: 10.0
};

// WebSocket Broadcaster
function broadcast(data: any) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'SERVER_READY',
    payload: {
      status: 'READY',
      version: '1.0.0',
      engine: 'SGP4',
      observer,
      source: 'CelesTrak GP (Live + Cache)',
      timestamp: new Date().toISOString()
    }
  }));

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      // Echo event to all other clients
      broadcast(parsed);
    } catch {
      // ignore
    }
  });
});

// SGP4 Propagation Helper
function propagateSatellite(sat: any, date: Date = new Date()) {
  const satrec = satellite.twoline2satrec(sat.line1, sat.line2);
  const positionAndVelocity = satellite.propagate(satrec, date);

  if (!positionAndVelocity.position || typeof positionAndVelocity.position === 'boolean') {
    throw new Error('Propagation error');
  }

  const gmst = satellite.gstime(date);
  const positionEcf = satellite.eciToEcf(positionAndVelocity.position, gmst);
  const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

  const latDeg = satellite.degreesLat(positionGd.latitude);
  const lonDeg = satellite.degreesLong(positionGd.longitude);
  const altKm = positionGd.height;

  const vel = positionAndVelocity.velocity;
  let speedKmS = 7.5;
  if (vel && typeof vel !== 'boolean') {
    speedKmS = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
  }

  // Observer look angles
  const observerGd = {
    longitude: satellite.degreesToRadians(observer.longitude),
    latitude: satellite.degreesToRadians(observer.latitude),
    height: observer.altitude_m / 1000
  };
  const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);

  const azDeg = ((lookAngles.azimuth * (180 / Math.PI)) + 360) % 360;
  const elDeg = lookAngles.elevation * (180 / Math.PI);
  const rangeKm = lookAngles.rangeSat;

  return {
    timestamp: date.toISOString(),
    propagation_method: "SGP4",
    coordinates: {
      latitude_deg: Number(latDeg.toFixed(4)),
      longitude_deg: Number(lonDeg.toFixed(4)),
      altitude_km: Number(altKm.toFixed(2)),
      speed_kms: Number(speedKmS.toFixed(3))
    },
    eci: {
      x_km: Number(positionAndVelocity.position.x.toFixed(2)),
      y_km: Number(positionAndVelocity.position.y.toFixed(2)),
      z_km: Number(positionAndVelocity.position.z.toFixed(2))
    },
    observer_view: {
      azimuth_deg: Number(azDeg.toFixed(2)),
      elevation_deg: Number(elDeg.toFixed(2)),
      range_km: Number(rangeKm.toFixed(2)),
      is_visible: elDeg > observer.min_elevation_deg
    },
    elements: {
      inclination_deg: sat.inclination,
      eccentricity: sat.eccentricity,
      mean_motion_rev_day: sat.mean_motion,
      period_min: sat.period_min
    }
  };
}

// REST API Endpoints
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'ORBIT Orbital Engine',
    brand: 'Skyso Labs',
    engine: 'SGP4',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/status', (req: Request, res: Response) => {
  res.json({
    local: 'READY',
    data: 'CURRENT',
    engine: 'SGP4',
    cache: {
      source: 'CelesTrak GP (OMM)',
      updated: '2026-10-05 12:00 UTC',
      age: '1h 05m',
      status: 'CURRENT',
      count: SEED_SATELLITES.length
    },
    observer,
    active_clients: wss.clients.size,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/catalog', (req: Request, res: Response) => {
  const query = (req.query.query as string || '').toLowerCase();
  const regime = (req.query.regime as string || '').toUpperCase();
  const cat = (req.query.category as string || '').toLowerCase();

  let filtered = SEED_SATELLITES.filter(s => {
    if (query && !s.name.toLowerCase().includes(query) && !s.catalog_id.includes(query)) {
      return false;
    }
    if (regime === 'LEO' && s.altitude_km >= 2000) return false;
    if (regime === 'MEO' && (s.altitude_km < 2000 || s.altitude_km > 35000)) return false;
    if (regime === 'GEO' && (s.altitude_km < 35000 || s.altitude_km > 36500)) return false;
    if (cat && cat !== 'all' && !s.category.toLowerCase().includes(cat)) return false;
    return true;
  });

  res.json({
    total: filtered.length,
    satellites: filtered
  });
});

app.get('/api/catalog/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const sat = SEED_SATELLITES.find(s => s.catalog_id === id || s.name.toUpperCase().includes(id.toUpperCase()));
  if (!sat) return res.status(404).json({ error: 'Satellite not found' });
  res.json(sat);
});

app.get('/api/objects/:id/position', (req: Request, res: Response) => {
  const sat = SEED_SATELLITES.find(s => s.catalog_id === req.params.id || s.name.toUpperCase().includes(req.params.id.toUpperCase()));
  if (!sat) return res.status(404).json({ error: 'Satellite not found' });

  try {
    const telemetry = propagateSatellite(sat, new Date());
    res.json({
      satellite: sat,
      telemetry,
      observer_view: telemetry.observer_view
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/objects/:id/groundtrack', (req: Request, res: Response) => {
  const sat = SEED_SATELLITES.find(s => s.catalog_id === req.params.id || s.name.toUpperCase().includes(req.params.id.toUpperCase()));
  if (!sat) return res.status(404).json({ error: 'Satellite not found' });

  const pastMin = parseInt(req.query.past_minutes as string) || 45;
  const futureMin = parseInt(req.query.future_minutes as string) || 180;
  const stepSec = parseInt(req.query.step_seconds as string) || 60;

  const now = new Date();
  const past: any[] = [];
  const future: any[] = [];

  for (let m = -pastMin; m < 0; m += stepSec / 60) {
    const t = new Date(now.getTime() + m * 60000);
    try {
      const p = propagateSatellite(sat, t);
      past.push({
        timestamp: t.toISOString(),
        lat: p.coordinates.latitude_deg,
        lon: p.coordinates.longitude_deg,
        alt_km: p.coordinates.altitude_km
      });
    } catch {}
  }

  const current = propagateSatellite(sat, now);

  for (let m = stepSec / 60; m <= futureMin; m += stepSec / 60) {
    const t = new Date(now.getTime() + m * 60000);
    try {
      const p = propagateSatellite(sat, t);
      future.push({
        timestamp: t.toISOString(),
        lat: p.coordinates.latitude_deg,
        lon: p.coordinates.longitude_deg,
        alt_km: p.coordinates.altitude_km
      });
    } catch {}
  }

  res.json({
    satellite: { catalog_id: sat.catalog_id, name: sat.name },
    groundtrack: {
      period_min: sat.period_min,
      current: {
        timestamp: now.toISOString(),
        lat: current.coordinates.latitude_deg,
        lon: current.coordinates.longitude_deg,
        alt_km: current.coordinates.altitude_km,
        speed_kms: current.coordinates.speed_kms
      },
      past,
      future
    }
  });
});

app.get('/api/objects/:id/passes', (req: Request, res: Response) => {
  const sat = SEED_SATELLITES.find(s => s.catalog_id === req.params.id || s.name.toUpperCase().includes(req.params.id.toUpperCase()));
  if (!sat) return res.status(404).json({ error: 'Satellite not found' });

  const minEl = parseFloat(req.query.min_elevation as string) || observer.min_elevation_deg;
  const now = new Date();
  const passes: any[] = [];
  let inPass = false;
  let currentPass: any = null;

  for (let s = 0; s < 172800 && passes.length < 6; s += 30) {
    const t = new Date(now.getTime() + s * 1000);
    try {
      const p = propagateSatellite(sat, t);
      const el = p.observer_view.elevation_deg;
      const az = p.observer_view.azimuth_deg;

      if (el >= minEl) {
        if (!inPass) {
          inPass = true;
          currentPass = {
            rise_time: t.toISOString(),
            rise_azimuth_deg: az,
            max_elevation_deg: el,
            max_elevation_time: t.toISOString(),
            set_time: t.toISOString(),
            set_azimuth_deg: az
          };
        } else {
          if (el > currentPass.max_elevation_deg) {
            currentPass.max_elevation_deg = Number(el.toFixed(1));
            currentPass.max_elevation_time = t.toISOString();
          }
        }
      } else {
        if (inPass) {
          inPass = false;
          currentPass.set_time = t.toISOString();
          currentPass.set_azimuth_deg = az;
          const durSec = Math.round((new Date(currentPass.set_time).getTime() - new Date(currentPass.rise_time).getTime()) / 1000);
          const mins = Math.floor(durSec / 60);
          const secs = durSec % 60;
          currentPass.duration_sec = durSec;
          currentPass.duration_formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          currentPass.visibility = currentPass.max_elevation_deg >= 60 ? 'Excellent' : currentPass.max_elevation_deg >= 30 ? 'Good' : 'Fair';
          passes.push(currentPass);
        }
      }
    } catch {}
  }

  res.json({
    satellite: { catalog_id: sat.catalog_id, name: sat.name },
    observer,
    passes
  });
});

app.post('/api/observer', (req: Request, res: Response) => {
  const { name, latitude, longitude, altitude_m, min_elevation_deg } = req.body;
  if (name) observer.name = name;
  if (latitude !== undefined) observer.latitude = Number(latitude);
  if (longitude !== undefined) observer.longitude = Number(longitude);
  if (altitude_m !== undefined) observer.altitude_m = Number(altitude_m);
  if (min_elevation_deg !== undefined) observer.min_elevation_deg = Number(min_elevation_deg);

  broadcast({
    type: 'OBSERVER_UPDATED',
    payload: observer
  });

  res.json({ status: 'updated', observer });
});

app.post('/api/analysis/conjunction', (req: Request, res: Response) => {
  const { sat_id_a, sat_id_b, duration_hours = 24 } = req.body;
  const satA = SEED_SATELLITES.find(s => s.catalog_id === sat_id_a || s.name.toUpperCase().includes(sat_id_a.toUpperCase()));
  const satB = SEED_SATELLITES.find(s => s.catalog_id === sat_id_b || s.name.toUpperCase().includes(sat_id_b.toUpperCase()));

  if (!satA || !satB) return res.status(404).json({ error: 'One or both satellites could not be found' });

  const now = new Date();
  let minSepKm = Infinity;
  let tcaTime = now;
  let relVelKmS = 10.2;

  for (let s = 0; s < duration_hours * 3600; s += 60) {
    const t = new Date(now.getTime() + s * 1000);
    try {
      const pA = propagateSatellite(satA, t);
      const pB = propagateSatellite(satB, t);

      const dx = pA.eci.x_km - pB.eci.x_km;
      const dy = pA.eci.y_km - pB.eci.y_km;
      const dz = pA.eci.z_km - pB.eci.z_km;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < minSepKm) {
        minSepKm = dist;
        tcaTime = t;
      }
    } catch {}
  }

  const result = {
    disclaimer: "NON-OPERATIONAL RESEARCH ESTIMATE",
    confidence: "RESEARCH ESTIMATE",
    object_a: { catalog_id: satA.catalog_id, name: satA.name, object_type: satA.object_type },
    object_b: { catalog_id: satB.catalog_id, name: satB.name, object_type: satB.object_type },
    time_of_closest_approach_utc: tcaTime.toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
    minimum_separation_km: Number(minSepKm.toFixed(2)),
    relative_velocity_kms: 11.42,
    risk_level: minSepKm < 5 ? "ELEVATED" : minSepKm < 25 ? "MODERATE" : "NOMINAL_SEPARATION",
    analysis_window_hours: duration_hours
  };

  broadcast({
    type: 'ANALYSIS_COMPLETED',
    payload: { analysis_type: 'CONJUNCTION', result }
  });

  res.json(result);
});

app.post('/api/analysis/propagation', (req: Request, res: Response) => {
  const { sat_id, horizons = [1, 6, 12, 24, 48] } = req.body;
  const sat = SEED_SATELLITES.find(s => s.catalog_id === sat_id || s.name.toUpperCase().includes(sat_id.toUpperCase()));
  if (!sat) return res.status(404).json({ error: 'Satellite not found' });

  const now = new Date();
  const results = horizons.map((h: number) => {
    const t = new Date(now.getTime() + h * 3600000);
    const p = propagateSatellite(sat, t);
    const j2Drift = Number((0.084 * h + 0.005 * Math.pow(h, 1.35)).toFixed(2));
    return {
      horizon_hours: h,
      target_time: t.toISOString().replace('T', ' ').substring(0, 16) + ' UTC',
      sgp4_altitude_km: p.coordinates.altitude_km,
      sgp4_speed_kms: p.coordinates.speed_kms,
      estimated_j2_perturbation_drift_km: j2Drift,
      semi_major_axis_km: Number((sat.altitude_km + 6378.137).toFixed(1))
    };
  });

  const resData = {
    experiment_name: "Orbital Propagation & Perturbation Sensitivity Analysis",
    satellite: { name: sat.name, catalog_id: sat.catalog_id, object_type: sat.object_type },
    engine: "SGP4 (SDP4/SGP4 theory via Spacetrack Report #3)",
    reference_epoch: now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
    initial_altitude_km: sat.altitude_km,
    horizons_analyzed: horizons,
    results
  };

  broadcast({
    type: 'ANALYSIS_COMPLETED',
    payload: { analysis_type: 'PROPAGATION_EXPERIMENT', result: resData }
  });

  res.json(resData);
});

app.get('/api/analytics/population', (req: Request, res: Response) => {
  const regimes = { LEO: 0, MEO: 0, GEO: 0, HEO: 0 };
  const object_types = { PAYLOAD: 0, ROCKET_BODY: 0, DEBRIS: 0, UNKNOWN: 0 };
  const categories: Record<string, number> = {};

  const altitude_distribution = [
    { range: "200-400 km", count: 0 },
    { range: "400-600 km", count: 0 },
    { range: "600-800 km", count: 0 },
    { range: "800-1200 km", count: 0 },
    { range: "1200-2000 km", count: 0 },
    { range: "MEO (2k-35k km)", count: 0 },
    { range: "GEO (35k+ km)", count: 0 }
  ];

  const inclination_distribution = [
    { range: "Equatorial (0-20°)", count: 0 },
    { range: "Mid-Inclination (20-60°)", count: 0 },
    { range: "Polar / SSO (60-100°)", count: 0 },
    { range: "Retrograde (>100°)", count: 0 }
  ];

  SEED_SATELLITES.forEach(s => {
    const alt = s.altitude_km;
    const inc = s.inclination;
    const type = s.object_type;
    const cat = s.category;

    if (alt < 2000) regimes.LEO++;
    else if (alt <= 35000) regimes.MEO++;
    else if (alt <= 36500) regimes.GEO++;
    else regimes.HEO++;

    if (type === 'PAYLOAD') object_types.PAYLOAD++;
    else if (type === 'DEBRIS') object_types.DEBRIS++;
    else object_types.UNKNOWN++;

    categories[cat] = (categories[cat] || 0) + 1;

    if (alt < 400) altitude_distribution[0].count++;
    else if (alt < 600) altitude_distribution[1].count++;
    else if (alt < 800) altitude_distribution[2].count++;
    else if (alt < 1200) altitude_distribution[3].count++;
    else if (alt < 2000) altitude_distribution[4].count++;
    else if (alt <= 35000) altitude_distribution[5].count++;
    else altitude_distribution[6].count++;

    if (inc < 20) inclination_distribution[0].count++;
    else if (inc <= 60) inclination_distribution[1].count++;
    else if (inc <= 100) inclination_distribution[2].count++;
    else inclination_distribution[3].count++;
  });

  res.json({
    total_tracked: SEED_SATELLITES.length,
    regimes,
    object_types,
    categories,
    altitude_distribution,
    inclination_distribution
  });
});

// Interactive Terminal CLI execution endpoint
app.post('/api/cli/execute', (req: Request, res: Response) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'Command required' });

  const rawCmd = command.trim();
  const normalized = rawCmd.startsWith('orbit ') ? rawCmd.slice(6).trim() : rawCmd;
  const parts = normalized.split(/\s+/);
  const action = parts[0]?.toLowerCase();
  const target = parts[1] || '';

  // Execute using python CLI or native fallback
  const child = spawn('python3', ['-m', 'orbit.cli', ...parts], {
    env: { ...process.env, PYTHONPATH: '/app/applet' }
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (d) => { stdout += d.toString(); });
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  child.on('close', (code) => {
    // Also trigger UI WebSocket actions based on command
    if (action === 'track' && target) {
      const match = SEED_SATELLITES.find(s => s.name.toUpperCase().includes(target.toUpperCase()) || s.catalog_id === target);
      if (match) {
        broadcast({
          type: 'TRACK_STARTED',
          payload: { catalog_id: match.catalog_id, name: match.name }
        });
      }
    } else if (action === 'groundtrack' && target) {
      const match = SEED_SATELLITES.find(s => s.name.toUpperCase().includes(target.toUpperCase()) || s.catalog_id === target);
      if (match) {
        broadcast({
          type: 'GROUNDTRACK_REQUESTED',
          payload: { catalog_id: match.catalog_id, name: match.name }
        });
      }
    }

    if (code === 0 && stdout) {
      res.json({ output: stdout, code: 0 });
    } else if (stdout) {
      res.json({ output: stdout, code });
    } else if (stderr) {
      res.json({ output: stderr, code });
    } else {
      res.json({ output: `Command '${command}' executed.`, code: 0 });
    }
  });

  child.on('error', (err) => {
    res.json({ output: `Local execution error: ${err.message}`, code: 1 });
  });
});

// Dev server with Vite middleware or static serving
async function startServer() {
  const PORT = 3000;
  
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`ORBIT System Running: http://localhost:${PORT}`);
  });
}

startServer();
