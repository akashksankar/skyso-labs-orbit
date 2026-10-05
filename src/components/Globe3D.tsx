import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { Satellite, ObserverConfig } from '../types/orbit';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Layers, 
  Crosshair, 
  Eye, 
  Zap, 
  Compass, 
  Orbit, 
  Maximize2, 
  Info, 
  Globe2, 
  Sparkles,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface Globe3DProps {
  satellites: Satellite[];
  selectedSat: Satellite | null;
  onSelectSatellite: (sat: Satellite) => void;
  observer: ObserverConfig;
  highlightedConstellation?: string | null;
}

const EARTH_RADIUS = 5.0;

// High-fidelity procedural Earth textures (Day, Night, Specular/Roughness, Clouds)
function createPhotorealisticEarthTextures(): {
  dayTexture: THREE.CanvasTexture;
  nightTexture: THREE.CanvasTexture;
  roughnessTexture: THREE.CanvasTexture;
  cloudsTexture: THREE.CanvasTexture;
} {
  const width = 2048;
  const height = 1024;

  const toCanvas = (lat: number, lon: number): [number, number] => [
    ((lon + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ];

  // 1. DAY CANVAS: Photorealistic oceans, coastal shelves, biomes, deserts, ice
  const canvasDay = document.createElement('canvas');
  canvasDay.width = width;
  canvasDay.height = height;
  const ctxDay = canvasDay.getContext('2d')!;

  // 2. ROUGHNESS CANVAS: Water = black (0.05, highly reflective), Land = light gray (0.85, matte)
  const canvasRough = document.createElement('canvas');
  canvasRough.width = width;
  canvasRough.height = height;
  const ctxRough = canvasRough.getContext('2d')!;

  // Oceans base: deep abyssal ocean gradient
  const oceanGrad = ctxDay.createRadialGradient(width / 2, height / 2, 120, width / 2, height / 2, width);
  oceanGrad.addColorStop(0, '#0a2342');
  oceanGrad.addColorStop(0.4, '#07172c');
  oceanGrad.addColorStop(1, '#040d1a');
  ctxDay.fillStyle = oceanGrad;
  ctxDay.fillRect(0, 0, width, height);

  // Roughness: Ocean is glossy black
  ctxRough.fillStyle = '#0a0a0a';
  ctxRough.fillRect(0, 0, width, height);

  // Draw land polygon helper
  const drawLandmass = (
    coords: [number, number][],
    fillColor: string,
    shelfColor: string = 'rgba(14, 116, 144, 0.55)',
    shelfWidth: number = 10
  ) => {
    if (coords.length === 0) return;

    // A. Continental shelf shallow turquoise glow
    if (shelfWidth > 0) {
      ctxDay.beginPath();
      const [sx0, sy0] = toCanvas(coords[0][0], coords[0][1]);
      ctxDay.moveTo(sx0, sy0);
      for (let i = 1; i < coords.length; i++) {
        const [x, y] = toCanvas(coords[i][0], coords[i][1]);
        ctxDay.lineTo(x, y);
      }
      ctxDay.closePath();
      ctxDay.strokeStyle = shelfColor;
      ctxDay.lineWidth = shelfWidth;
      ctxDay.stroke();
    }

    // B. Main landmass
    ctxDay.beginPath();
    ctxRough.beginPath();
    const [lx0, ly0] = toCanvas(coords[0][0], coords[0][1]);
    ctxDay.moveTo(lx0, ly0);
    ctxRough.moveTo(lx0, ly0);
    for (let i = 1; i < coords.length; i++) {
      const [x, y] = toCanvas(coords[i][0], coords[i][1]);
      ctxDay.lineTo(x, y);
      ctxRough.lineTo(x, y);
    }
    ctxDay.closePath();
    ctxRough.closePath();

    ctxDay.fillStyle = fillColor;
    ctxDay.fill();
    ctxDay.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctxDay.lineWidth = 1;
    ctxDay.stroke();

    ctxRough.fillStyle = '#d0d0d0'; // Land is matte
    ctxRough.fill();
  };

  // Color constants
  const greenForest = '#1e4024';
  const lushGreen = '#2a5a2e';
  const temperateGreen = '#365314';
  const desertSand = '#b48a52';
  const saharaSand = '#c29759';
  const outbackRed = '#a35f3d';
  const polarIce = '#f0f9ff';
  const shelfAqua = 'rgba(6, 182, 212, 0.5)';

  // NORTH AMERICA (Alaska, Canada, Lower 48, Mexico, Central America)
  drawLandmass([
    [71, -164], [72, -145], [70, -125], [64, -85], [58, -62], [47, -53],
    [44, -64], [41, -70], [35, -75], [29, -81], [25, -80], [25, -81],
    [29, -85], [30, -90], [26, -97], [20, -96], [16, -93], [14, -88],
    [9, -83], [8, -77], [12, -86], [16, -95], [20, -105], [23, -110],
    [32, -117], [37, -122], [46, -124], [54, -132], [58, -137], [60, -148],
    [65, -168], [71, -164]
  ], greenForest, shelfAqua, 12);

  // Florida Peninsula & Bahamas Bank
  drawLandmass([
    [30, -81], [25, -80], [25, -82], [30, -85], [30, -81]
  ], lushGreen, 'rgba(34, 211, 238, 0.75)', 16);

  // American Southwest / Great Plains Arid
  drawLandmass([
    [40, -114], [38, -104], [31, -102], [26, -106], [32, -116], [40, -114]
  ], desertSand, 'rgba(0,0,0,0)', 0);

  // SOUTH AMERICA
  drawLandmass([
    [12, -72], [10, -62], [5, -52], [-2, -44], [-8, -35], [-18, -39],
    [-24, -46], [-33, -53], [-42, -64], [-53, -69], [-55, -67], [-50, -75],
    [-40, -74], [-30, -72], [-18, -71], [-5, -81], [2, -79], [8, -77], [12, -72]
  ], lushGreen, shelfAqua, 10);

  // Amazon Basin rainforest heart
  drawLandmass([
    [2, -68], [0, -52], [-8, -48], [-12, -60], [-8, -72], [2, -68]
  ], '#143d1c', 'rgba(0,0,0,0)', 0);

  // Andes mountain ridgeline
  drawLandmass([
    [8, -74], [-5, -77], [-15, -72], [-30, -70], [-45, -72], [-54, -69],
    [-45, -70], [-30, -68], [-15, -70], [-5, -75], [8, -74]
  ], '#6b5e43', 'rgba(0,0,0,0)', 0);

  // EURASIA (Europe, Scandinavia, Russia, China, India, SE Asia)
  drawLandmass([
    [71, 25], [70, 45], [73, 75], [76, 110], [70, 160], [66, 170],
    [58, 162], [53, 142], [43, 132], [38, 126], [35, 119], [22, 114],
    [12, 109], [8, 104], [13, 100], [21, 90], [10, 80], [8, 77],
    [22, 69], [25, 62], [28, 50], [36, 36], [41, 28], [40, 19],
    [37, 15], [38, 9], [36, -5], [43, -9], [48, -4], [52, 2],
    [58, 7], [64, 12], [71, 25]
  ], greenForest, shelfAqua, 10);

  // Western & Central Europe
  drawLandmass([
    [55, 8], [52, 5], [48, -2], [44, -1], [43, 3], [44, 9],
    [48, 14], [54, 14], [55, 8]
  ], lushGreen, shelfAqua, 8);

  // British Isles & Ireland
  drawLandmass([
    [58, -5], [58, -2], [53, 0], [50, -5], [54, -4], [58, -5]
  ], lushGreen, shelfAqua, 10);
  drawLandmass([
    [55, -7], [54, -6], [51, -9], [54, -10], [55, -7]
  ], lushGreen, shelfAqua, 8);

  // Scandinavian Peninsula
  drawLandmass([
    [71, 26], [68, 15], [62, 5], [58, 7], [56, 12], [60, 18], [66, 24], [71, 26]
  ], temperateGreen, shelfAqua, 8);

  // Iberian Peninsula (Spain & Portugal)
  drawLandmass([
    [43, -9], [43, -2], [37, -2], [36, -6], [37, -9], [42, -9], [43, -9]
  ], '#7a7042', shelfAqua, 8);

  // Italy Peninsula Boot
  drawLandmass([
    [45, 8], [45, 12], [41, 15], [40, 18], [38, 16], [41, 13], [44, 8], [45, 8]
  ], lushGreen, shelfAqua, 6);

  // India Subcontinent
  drawLandmass([
    [28, 70], [24, 70], [18, 73], [12, 75], [8, 77], [10, 80],
    [16, 82], [22, 88], [26, 88], [28, 70]
  ], lushGreen, shelfAqua, 10);

  // Japan Archipelago
  drawLandmass([
    [45, 142], [43, 145], [36, 140], [33, 131], [35, 134], [40, 140], [45, 142]
  ], lushGreen, shelfAqua, 8);

  // AFRICA (North coast, Sahara, Sahel, Congo, Horn, South Africa, Madagascar)
  drawLandmass([
    [36, -6], [36, 11], [32, 20], [31, 32], [28, 34], [22, 37],
    [12, 44], [11, 51], [5, 48], [-4, 40], [-15, 40], [-25, 33],
    [-34, 26], [-34, 18], [-28, 15], [-17, 12], [-5, 12], [4, 9],
    [5, 2], [5, -5], [10, -14], [15, -17], [22, -16], [32, -9], [36, -6]
  ], temperateGreen, shelfAqua, 10);

  // Sahara Desert + Arabian Peninsula (Golden Sand Dunes)
  drawLandmass([
    [32, -10], [35, 10], [32, 25], [30, 35], [30, 48], [24, 58],
    [16, 54], [13, 45], [18, 38], [15, 30], [18, 18], [15, -5],
    [18, -16], [28, -12], [32, -10]
  ], saharaSand, 'rgba(0,0,0,0)', 0);

  // Arabian Peninsula Desert Core
  drawLandmass([
    [30, 35], [30, 48], [24, 58], [18, 55], [14, 48], [17, 42], [25, 38], [30, 35]
  ], desertSand, 'rgba(0,0,0,0)', 0);

  // Congo Rainforest
  drawLandmass([
    [5, 12], [4, 28], [-4, 28], [-5, 14], [5, 12]
  ], '#123819', 'rgba(0,0,0,0)', 0);

  // Madagascar
  drawLandmass([
    [-12, 49], [-16, 50], [-25, 47], [-25, 43], [-16, 44], [-12, 49]
  ], lushGreen, shelfAqua, 8);

  // AUSTRALIA & NEW ZEALAND
  drawLandmass([
    [-12, 131], [-14, 136], [-12, 142], [-18, 146], [-28, 153],
    [-37, 150], [-38, 141], [-35, 117], [-32, 115], [-22, 114],
    [-16, 123], [-14, 129], [-12, 131]
  ], desertSand, shelfAqua, 14);

  // Australian Red Outback Center
  drawLandmass([
    [-20, 124], [-21, 138], [-28, 138], [-29, 126], [-20, 124]
  ], outbackRed, 'rgba(0,0,0,0)', 0);

  // New Zealand
  drawLandmass([
    [-35, 173], [-38, 178], [-41, 175], [-43, 172], [-46, 168], [-42, 172], [-35, 173]
  ], lushGreen, shelfAqua, 8);

  // INDONESIAN ARCHIPELAGO & PHILIPPINES
  const drawIsland = (lat: number, lon: number, rw: number, rh: number) => {
    const [cx, cy] = toCanvas(lat, lon);
    ctxDay.beginPath();
    ctxDay.ellipse(cx, cy, rw, rh, 0.2, 0, Math.PI * 2);
    ctxDay.fillStyle = '#225528';
    ctxDay.fill();
    ctxDay.strokeStyle = shelfAqua;
    ctxDay.lineWidth = 4;
    ctxDay.stroke();
    ctxRough.beginPath();
    ctxRough.ellipse(cx, cy, rw, rh, 0.2, 0, Math.PI * 2);
    ctxRough.fillStyle = '#c0c0c0';
    ctxRough.fill();
  };
  drawIsland(-0.5, 101, 26, 8); // Sumatra
  drawIsland(-7, 110, 24, 7);   // Java
  drawIsland(0, 114, 20, 18);   // Borneo
  drawIsland(-2, 121, 14, 14);  // Sulawesi
  drawIsland(-4, 138, 30, 12);  // New Guinea
  drawIsland(13, 122, 14, 22);  // Philippines

  // POLAR ICE CAPS (Greenland, Arctic, Antarctica)
  drawLandmass([
    [82, -40], [80, -22], [72, -22], [65, -38], [60, -45],
    [65, -52], [76, -60], [82, -40]
  ], polarIce, 'rgba(255, 255, 255, 0.6)', 6);

  // Antarctica Continent
  drawLandmass([
    [-66, -180], [-66, 180], [-90, 180], [-90, -180]
  ], polarIce, 'rgba(255, 255, 255, 0.7)', 6);

  // 2. NIGHT CANVAS: Golden clusters of city lights in population centers
  const canvasNight = document.createElement('canvas');
  canvasNight.width = width;
  canvasNight.height = height;
  const ctxNight = canvasNight.getContext('2d')!;
  ctxNight.fillStyle = '#010204';
  ctxNight.fillRect(0, 0, width, height);

  const majorCities: [number, number, number][] = [
    [40.71, -74.00, 11], // New York
    [34.05, -118.24, 10], // Los Angeles
    [41.87, -87.62, 9],  // Chicago
    [29.76, -95.36, 8],  // Houston
    [37.77, -122.41, 9], // San Francisco
    [25.76, -80.19, 8],  // Miami
    [51.50, -0.12, 12],  // London
    [48.85, 2.35, 11],   // Paris
    [52.52, 13.40, 8],   // Berlin
    [50.85, 4.35, 9],    // Brussels / Benelux
    [41.90, 12.49, 8],   // Rome
    [40.41, -3.70, 8],   // Madrid
    [35.67, 139.65, 14], // Tokyo
    [34.69, 135.50, 10], // Osaka
    [31.23, 121.47, 13], // Shanghai
    [39.90, 116.40, 12], // Beijing
    [22.31, 114.16, 12], // Hong Kong / Pearl River
    [37.56, 126.97, 11], // Seoul
    [28.61, 77.20, 12],  // New Delhi
    [19.07, 72.87, 12],  // Mumbai
    [13.08, 80.27, 9],   // Chennai
    [30.04, 31.23, 10],  // Cairo
    [-23.55, -46.63, 11],// São Paulo
    [-22.90, -43.17, 9], // Rio de Janeiro
    [-34.60, -58.38, 9], // Buenos Aires
    [-33.86, 151.20, 9], // Sydney
    [-37.81, 144.96, 8], // Melbourne
    [55.75, 37.61, 11],  // Moscow
    [59.93, 30.33, 8],   // St Petersburg
    [1.35, 103.81, 9],   // Singapore
    [25.20, 55.27, 9],   // Dubai
    [24.71, 46.67, 8],   // Riyadh
    [13.75, 100.50, 9],  // Bangkok
    [32.08, 34.78, 7],   // Tel Aviv
  ];

  ctxNight.fillStyle = '#fef08a';
  for (const [lat, lon, r] of majorCities) {
    const [cx, cy] = toCanvas(lat, lon);
    const grad = ctxNight.createRadialGradient(cx, cy, 0, cx, cy, r * 4.0);
    grad.addColorStop(0, 'rgba(254, 240, 138, 0.98)');
    grad.addColorStop(0.3, 'rgba(245, 158, 11, 0.7)');
    grad.addColorStop(0.7, 'rgba(180, 83, 9, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctxNight.fillStyle = grad;
    ctxNight.beginPath();
    ctxNight.arc(cx, cy, r * 4.0, 0, Math.PI * 2);
    ctxNight.fill();
  }

  // 3. CLOUDS CANVAS: Multi-layer atmospheric storms and ITCZ bands
  const canvasClouds = document.createElement('canvas');
  canvasClouds.width = width;
  canvasClouds.height = height;
  const ctxClouds = canvasClouds.getContext('2d')!;
  ctxClouds.clearRect(0, 0, width, height);

  // Equatorial Intertropical Convergence Zone (ITCZ)
  for (let lon = -180; lon < 180; lon += 4) {
    const lat = Math.sin((lon / 180) * Math.PI * 3) * 6 + (Math.sin(lon * 0.1) * 3);
    const [cx, cy] = toCanvas(lat, lon);
    const r = 24 + Math.abs(Math.sin(lon)) * 26;
    const grad = ctxClouds.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.25)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctxClouds.fillStyle = grad;
    ctxClouds.beginPath();
    ctxClouds.arc(cx, cy, r, 0, Math.PI * 2);
    ctxClouds.fill();
  }

  // Mid-latitude cyclone whorls and storms
  const stormCenters: [number, number][] = [
    [54, -38], [48, 162], [-50, 78], [-56, -118], [62, -145], [-46, -22], [42, -60]
  ];
  for (const [lat, lon] of stormCenters) {
    const [cx, cy] = toCanvas(lat, lon);
    for (let arm = 0; arm < 4; arm++) {
      ctxClouds.beginPath();
      ctxClouds.arc(cx + Math.cos(arm * 1.5) * 22, cy + Math.sin(arm * 1.5) * 22, 65, 0, Math.PI * 1.6);
      ctxClouds.strokeStyle = 'rgba(255, 255, 255, 0.38)';
      ctxClouds.lineWidth = 20;
      ctxClouds.stroke();
    }
  }

  return {
    dayTexture: new THREE.CanvasTexture(canvasDay),
    nightTexture: new THREE.CanvasTexture(canvasNight),
    roughnessTexture: new THREE.CanvasTexture(canvasRough),
    cloudsTexture: new THREE.CanvasTexture(canvasClouds),
  };
}

// Convert geodetic lat/lon/alt to Cartesian vector
function latLonAltToVector3(latDeg: number, lonDeg: number, altKm: number = 0): THREE.Vector3 {
  const phi = (90 - latDeg) * (Math.PI / 180);
  const theta = (lonDeg + 180) * (Math.PI / 180);
  const radius = EARTH_RADIUS * (1.0 + altKm / 6378.137);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

// Billboard canvas sprite for satellite name tag
function createSatelliteLabelSprite(name: string, altKm: number, category: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 440;
  canvas.height = 110;
  const ctx = canvas.getContext('2d')!;

  let borderColor = '#06b6d4'; // cyan
  let bgRgba = 'rgba(4, 9, 20, 0.92)';
  if (category === 'Stations') borderColor = '#10b981';
  else if (category === 'Science' || category === 'Earth Science') borderColor = '#38bdf8';
  else if (category === 'Navigation') borderColor = '#f59e0b';
  else if (category === 'Debris') borderColor = '#f43f5e';
  else if (category === 'OneWeb') borderColor = '#818cf8';

  // Badge background with glowing border
  ctx.fillStyle = bgRgba;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.roundRect(8, 8, 424, 94, 14);
  ctx.fill();
  ctx.stroke();

  // Indicator dot
  ctx.fillStyle = borderColor;
  ctx.beginPath();
  ctx.arc(28, 42, 6, 0, Math.PI * 2);
  ctx.fill();

  // Text: Line 1 Satellite Name
  ctx.font = 'bold 30px "JetBrains Mono", monospace';
  ctx.fillStyle = '#ffffff';
  const displayName = name.length > 18 ? name.substring(0, 18) + '…' : name;
  ctx.fillText(displayName, 46, 52);

  // Text: Line 2 Altitude and Category
  ctx.font = '600 20px "JetBrains Mono", monospace';
  ctx.fillStyle = borderColor;
  ctx.fillText(`${altKm.toFixed(0)} km · ${category.toUpperCase()}`, 28, 84);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.5, 0.38, 1);
  return sprite;
}

// 3D Spacecraft Mesh with solar arrays
function createSpacecraftMesh(category: string, isSelected: boolean = false): THREE.Group {
  const group = new THREE.Group();

  let busColor = 0xd4af37;
  let panelColor = 0x1d4ed8;

  if (category === 'Stations') {
    busColor = 0xf8fafc;
    panelColor = 0x0284c7;
  } else if (category === 'Debris') {
    busColor = 0x64748b;
    panelColor = 0x475569;
  } else if (category === 'OneWeb') {
    busColor = 0xa5b4fc;
    panelColor = 0x4338ca;
  }

  // Central Avionics Bus
  const busGeom = new THREE.BoxGeometry(0.14, 0.14, 0.22);
  const busMat = new THREE.MeshStandardMaterial({
    color: busColor,
    metalness: 0.85,
    roughness: 0.15,
  });
  const bus = new THREE.Mesh(busGeom, busMat);
  group.add(bus);

  // Solar Panels (Left & Right)
  const panelGeom = new THREE.BoxGeometry(0.42, 0.018, 0.16);
  const panelMat = new THREE.MeshStandardMaterial({
    color: panelColor,
    metalness: 0.92,
    roughness: 0.08,
  });

  const panelLeft = new THREE.Mesh(panelGeom, panelMat);
  panelLeft.position.set(-0.29, 0, 0);
  group.add(panelLeft);

  const panelRight = new THREE.Mesh(panelGeom, panelMat);
  panelRight.position.set(0.29, 0, 0);
  group.add(panelRight);

  // Invisible larger hit sphere for effortless clicking
  const hitSphereGeom = new THREE.SphereGeometry(0.55, 12, 12);
  const hitSphereMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitSphere = new THREE.Mesh(hitSphereGeom, hitSphereMat);
  hitSphere.name = 'hitbox';
  group.add(hitSphere);

  return group;
}

export const Globe3D: React.FC<Globe3DProps> = ({
  satellites,
  selectedSat,
  onSelectSatellite,
  observer,
  highlightedConstellation,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [simTime, setSimTime] = useState<Date>(new Date());
  const [showOrbits, setShowOrbits] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [followCamera, setFollowCamera] = useState<boolean>(false);
  const [hoveredSat, setHoveredSat] = useState<Satellite | null>(null);

  const stateRef = useRef({
    simTime: new Date(),
    simSpeed: 1,
    isPaused: false,
    selectedSat: selectedSat,
    followCamera: false,
    showOrbits: true,
    showLabels: true,
  });

  useEffect(() => {
    stateRef.current.simSpeed = simSpeed;
    stateRef.current.isPaused = isPaused;
    stateRef.current.selectedSat = selectedSat;
    stateRef.current.followCamera = followCamera;
    stateRef.current.showOrbits = showOrbits;
    stateRef.current.showLabels = showLabels;
  }, [simSpeed, isPaused, selectedSat, followCamera, showOrbits, showLabels]);

  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    earthMesh: THREE.Mesh;
    cloudsMesh: THREE.Mesh;
    satellitesGroup: THREE.Group;
    labelsGroup: THREE.Group;
    orbitLineGroup: THREE.Group;
    observerPin: THREE.Mesh;
    satObjectMap: Map<string, { group: THREE.Group; sprite: THREE.Sprite }>;
    selectionReticle: THREE.Group;
    gridGroup: THREE.Group;
  } | null>(null);

  // Setup Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 650;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03060c);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 5, 17);

    // 2. High-Precision WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true, 
      powerPreference: 'high-performance' 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Scientific Space Lighting
    const ambientLight = new THREE.AmbientLight(0x1e293b, 0.95);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff8ee, 2.7);
    sunLight.position.set(35, 10, 25);
    scene.add(sunLight);

    // Subtle opposite rim bounce
    const earthBounceLight = new THREE.DirectionalLight(0x0e7490, 0.45);
    earthBounceLight.position.set(-30, -5, -20);
    scene.add(earthBounceLight);

    // 4. Cosmos Deep Starfield
    const starGeom = new THREE.BufferGeometry();
    const starCount = 4000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const r = 90 + Math.random() * 85;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i + 2] = r * Math.cos(phi);
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ 
      color: 0xd1d5db, 
      size: 0.95, 
      sizeAttenuation: true 
    });
    scene.add(new THREE.Points(starGeom, starMat));

    // 5. Earth Sphere with Day Texture & Specular Map
    const { dayTexture, nightTexture, roughnessTexture, cloudsTexture } = createPhotorealisticEarthTextures();
    const earthGeom = new THREE.SphereGeometry(EARTH_RADIUS, 96, 96);
    const earthMat = new THREE.MeshStandardMaterial({
      map: dayTexture,
      roughnessMap: roughnessTexture,
      metalness: 0.1,
      roughness: 0.75,
      emissive: new THREE.Color(0xfef08a),
      emissiveMap: nightTexture,
      emissiveIntensity: 0.75,
    });

    const earthMesh = new THREE.Mesh(earthGeom, earthMat);
    scene.add(earthMesh);

    // 6. Floating Cloud Layer
    const cloudsGeom = new THREE.SphereGeometry(EARTH_RADIUS * 1.018, 96, 96);
    const cloudsMat = new THREE.MeshStandardMaterial({
      map: cloudsTexture,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const cloudsMesh = new THREE.Mesh(cloudsGeom, cloudsMat);
    scene.add(cloudsMesh);

    // 7. Atmospheric Rayleigh Blue Limb Glow (Fresnel Shader)
    const atmosphereGeom = new THREE.SphereGeometry(EARTH_RADIUS * 1.042, 64, 64);
    const atmosphereMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(-vPosition);
          float fresnel = 1.0 - max(0.0, dot(vNormal, viewDir));
          float intensity = pow(fresnel, 3.2) * 1.5;
          gl_FragColor = vec4(0.22, 0.68, 1.0, intensity * 0.85);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeom, atmosphereMat);
    scene.add(atmosphereMesh);

    // 8. Astrodynamics Coordinate Grid Lines (Equator & Tropics)
    const gridGroup = new THREE.Group();
    const createLatRing = (latDeg: number, color: number, opacity: number = 0.3) => {
      const phi = (90 - latDeg) * (Math.PI / 180);
      const r = EARTH_RADIUS * 1.002 * Math.sin(phi);
      const y = EARTH_RADIUS * 1.002 * Math.cos(phi);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const theta = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)));
      }
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
      return new THREE.Line(geom, mat);
    };

    gridGroup.add(createLatRing(0, 0x06b6d4, 0.5));     // Equator (Cyan)
    gridGroup.add(createLatRing(23.44, 0x38bdf8, 0.25)); // Tropic of Cancer
    gridGroup.add(createLatRing(-23.44, 0x38bdf8, 0.25));// Tropic of Capricorn
    gridGroup.add(createLatRing(66.5, 0x94a3b8, 0.2));  // Arctic Circle
    gridGroup.add(createLatRing(-66.5, 0x94a3b8, 0.2)); // Antarctic Circle
    scene.add(gridGroup);

    // 9. Observer Ground Station Pin
    const observerPos = latLonAltToVector3(observer.latitude, observer.longitude, 0);
    const pinGeom = new THREE.ConeGeometry(0.14, 0.45, 16);
    pinGeom.rotateX(Math.PI / 2);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const observerPin = new THREE.Mesh(pinGeom, pinMat);
    observerPin.position.copy(observerPos);
    observerPin.lookAt(0, 0, 0);
    scene.add(observerPin);

    // 10. Multi-Ring Target Lock Reticle
    const selectionReticle = new THREE.Group();
    const ring1Geom = new THREE.RingGeometry(0.42, 0.47, 32);
    const ring1Mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const ring1 = new THREE.Mesh(ring1Geom, ring1Mat);
    selectionReticle.add(ring1);

    const ring2Geom = new THREE.RingGeometry(0.60, 0.63, 4);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide });
    const ring2 = new THREE.Mesh(ring2Geom, ring2Mat);
    selectionReticle.add(ring2);

    selectionReticle.visible = false;
    scene.add(selectionReticle);

    // Dynamic Groups
    const satellitesGroup = new THREE.Group();
    const labelsGroup = new THREE.Group();
    const orbitLineGroup = new THREE.Group();
    scene.add(satellitesGroup);
    scene.add(labelsGroup);
    scene.add(orbitLineGroup);

    const satObjectMap = new Map<string, { group: THREE.Group; sprite: THREE.Sprite }>();

    threeRef.current = {
      renderer,
      scene,
      camera,
      earthMesh,
      cloudsMesh,
      satellitesGroup,
      labelsGroup,
      orbitLineGroup,
      observerPin,
      satObjectMap,
      selectionReticle,
      gridGroup,
    };

    // Camera Orbit Controls (Spherical Rotation & Pan with Inertia)
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let spherical = { radius: 17, theta: 0, phi: Math.PI / 2.3 };

    const updateCamera = () => {
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 0, 0);
    };
    updateCamera();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        spherical.theta -= dx * 0.005;
        spherical.phi = Math.max(0.08, Math.min(Math.PI - 0.08, spherical.phi - dy * 0.005));
        updateCamera();
        prevMouse = { x: e.clientX, y: e.clientY };
      }

      // Raycast for hover detection
      const rect = renderer.domElement.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

      const targets: THREE.Object3D[] = [];
      satObjectMap.forEach(({ group, sprite }) => {
        targets.push(group, sprite);
      });
      const hits = raycaster.intersectObjects(targets, true);

      if (hits.length > 0) {
        let root: THREE.Object3D | null = hits[0].object;
        while (root && !root.userData?.catalog_id && root.parent) {
          root = root.parent;
        }
        if (root && root.userData?.catalog_id) {
          const matched = satellites.find(s => s.catalog_id === root!.userData.catalog_id);
          setHoveredSat(matched || null);
          container.style.cursor = 'pointer';
          return;
        }
      }
      setHoveredSat(null);
      container.style.cursor = isDragging ? 'grabbing' : 'grab';
    };

    const onMouseUp = () => { isDragging = false; };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = Math.max(6.2, Math.min(48, spherical.radius + e.deltaY * 0.018));
      updateCamera();
    };

    // Click handler for selecting satellite
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const targets: THREE.Object3D[] = [];
      satObjectMap.forEach(({ group, sprite }) => {
        targets.push(group, sprite);
      });

      const intersects = raycaster.intersectObjects(targets, true);
      if (intersects.length > 0) {
        let hit: THREE.Object3D | null = intersects[0].object;
        while (hit && !hit.userData?.catalog_id && hit.parent) {
          hit = hit.parent;
        }
        if (hit && hit.userData?.catalog_id) {
          const sat = satellites.find(s => s.catalog_id === hit!.userData.catalog_id);
          if (sat) {
            onSelectSatellite(sat);
          }
        }
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('click', onClick);

    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Animation Loop
    let lastTime = performance.now();
    let animId: number;

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);
      const deltaMs = now - lastTime;
      lastTime = now;

      const state = stateRef.current;

      // Advance simulation clock
      if (!state.isPaused) {
        const addedMs = deltaMs * state.simSpeed;
        const nextTime = new Date(state.simTime.getTime() + addedMs);
        state.simTime = nextTime;
        setSimTime(nextTime);
      }

      // Smooth slow Earth rotation
      earthMesh.rotation.y += 0.00025;
      gridGroup.rotation.y += 0.00025;
      // Independent clouds drifting rotation
      cloudsMesh.rotation.y += 0.00038;

      // Pulse reticle
      if (selectionReticle.visible) {
        selectionReticle.scale.setScalar(1.0 + Math.sin(now * 0.004) * 0.1);
        selectionReticle.rotation.z += 0.01;
        selectionReticle.lookAt(camera.position);
      }

      // Follow camera if active and target selected
      if (state.followCamera && state.selectedSat) {
        const currentData = satObjectMap.get(state.selectedSat.catalog_id);
        if (currentData) {
          const targetPos = currentData.group.position;
          camera.position.lerp(
            new THREE.Vector3(targetPos.x * 1.35, targetPos.y * 1.35 + 1.1, targetPos.z * 1.35),
            0.05
          );
          camera.lookAt(targetPos);
        }
      }

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('click', onClick);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  // Update Observer Pin Position
  useEffect(() => {
    if (!threeRef.current) return;
    const pinPos = latLonAltToVector3(observer.latitude, observer.longitude, 0);
    threeRef.current.observerPin.position.copy(pinPos);
    threeRef.current.observerPin.lookAt(0, 0, 0);
  }, [observer]);

  // Toggle Grid
  useEffect(() => {
    if (!threeRef.current) return;
    threeRef.current.gridGroup.visible = showGrid;
  }, [showGrid]);

  // Build spacecraft models, labels, and 3D orbit curves
  useEffect(() => {
    if (!threeRef.current) return;
    const { satellitesGroup, labelsGroup, orbitLineGroup, satObjectMap } = threeRef.current;

    while (satellitesGroup.children.length > 0) satellitesGroup.remove(satellitesGroup.children[0]);
    while (labelsGroup.children.length > 0) labelsGroup.remove(labelsGroup.children[0]);
    while (orbitLineGroup.children.length > 0) orbitLineGroup.remove(orbitLineGroup.children[0]);
    satObjectMap.clear();

    const currTime = stateRef.current.simTime;

    satellites.forEach(sat => {
      try {
        const satrec = satellite.twoline2satrec(sat.line1, sat.line2);
        const pv = satellite.propagate(satrec, currTime);
        if (!pv.position || typeof pv.position === 'boolean') return;

        const gmst = satellite.gstime(currTime);
        const gd = satellite.eciToGeodetic(pv.position, gmst);
        const lat = satellite.degreesLat(gd.latitude);
        const lon = satellite.degreesLong(gd.longitude);
        const alt = gd.height;

        const pos = latLonAltToVector3(lat, lon, alt);

        // 3D Spacecraft Mesh
        const isSelected = selectedSat?.catalog_id === sat.catalog_id;
        const spacecraft = createSpacecraftMesh(sat.category, isSelected);
        spacecraft.position.copy(pos);
        spacecraft.userData = { catalog_id: sat.catalog_id, name: sat.name };
        spacecraft.lookAt(0, 0, 0);
        satellitesGroup.add(spacecraft);

        // Floating Name Billboard
        const labelSprite = createSatelliteLabelSprite(sat.name, alt, sat.category);
        labelSprite.position.set(pos.x, pos.y + 0.38, pos.z);
        labelSprite.userData = { catalog_id: sat.catalog_id, name: sat.name };
        labelSprite.visible = showLabels;
        labelsGroup.add(labelSprite);

        satObjectMap.set(sat.catalog_id, { group: spacecraft, sprite: labelSprite });

        // Calculate 3D Orbit Path (72 segments)
        if (showOrbits && (selectedSat?.catalog_id === sat.catalog_id || sat.category === 'Stations' || sat.category === 'OneWeb')) {
          const points: THREE.Vector3[] = [];
          const period = sat.period_min || 92;
          const steps = 72;
          for (let i = 0; i <= steps; i++) {
            const t = new Date(currTime.getTime() + (i / steps) * period * 60000);
            const pv_i = satellite.propagate(satrec, t);
            if (pv_i.position && typeof pv_i.position !== 'boolean') {
              const gmst_i = satellite.gstime(t);
              const gd_i = satellite.eciToGeodetic(pv_i.position, gmst_i);
              points.push(
                latLonAltToVector3(
                  satellite.degreesLat(gd_i.latitude),
                  satellite.degreesLong(gd_i.longitude),
                  gd_i.height
                )
              );
            }
          }

          if (points.length > 2) {
            const orbitGeom = new THREE.BufferGeometry().setFromPoints(points);
            let orbitColor = isSelected ? 0x38bdf8 : 0x1e3a5f;
            if (!isSelected) {
              if (sat.category === 'Stations') orbitColor = 0x10b981;
              else if (sat.category === 'OneWeb') orbitColor = 0x818cf8;
            }
            const orbitMat = new THREE.LineBasicMaterial({
              color: orbitColor,
              linewidth: isSelected ? 2 : 1,
              transparent: true,
              opacity: isSelected ? 0.95 : 0.45,
            });
            orbitLineGroup.add(new THREE.Line(orbitGeom, orbitMat));
          }
        }
      } catch {}
    });
  }, [satellites, selectedSat, showOrbits, showLabels]);

  // Update positions in continuous animation tick
  useEffect(() => {
    const interval = setInterval(() => {
      if (!threeRef.current) return;
      const { satObjectMap, selectionReticle } = threeRef.current;
      const currTime = stateRef.current.simTime;

      satellites.forEach(sat => {
        const obj = satObjectMap.get(sat.catalog_id);
        if (!obj) return;
        try {
          const satrec = satellite.twoline2satrec(sat.line1, sat.line2);
          const pv = satellite.propagate(satrec, currTime);
          if (pv.position && typeof pv.position !== 'boolean') {
            const gmst = satellite.gstime(currTime);
            const gd = satellite.eciToGeodetic(pv.position, gmst);
            const pos = latLonAltToVector3(
              satellite.degreesLat(gd.latitude),
              satellite.degreesLong(gd.longitude),
              gd.height
            );

            obj.group.position.copy(pos);
            obj.group.lookAt(0, 0, 0);
            obj.sprite.position.set(pos.x, pos.y + 0.38, pos.z);
            obj.sprite.visible = stateRef.current.showLabels;

            if (selectedSat?.catalog_id === sat.catalog_id) {
              selectionReticle.visible = true;
              selectionReticle.position.copy(pos);
            }
          }
        } catch {}
      });
    }, 60);

    return () => clearInterval(interval);
  }, [satellites, selectedSat]);

  // Smooth camera glide when a satellite is selected
  useEffect(() => {
    if (!selectedSat || !threeRef.current) return;
    const { satObjectMap, camera } = threeRef.current;
    const targetObj = satObjectMap.get(selectedSat.catalog_id);
    if (targetObj) {
      const p = targetObj.group.position;
      const targetCamPos = new THREE.Vector3(p.x * 1.45, p.y * 1.45 + 1.4, p.z * 1.45);
      let frame = 0;
      const glide = () => {
        frame++;
        camera.position.lerp(targetCamPos, 0.08);
        camera.lookAt(p);
        if (frame < 30) requestAnimationFrame(glide);
      };
      glide();
    }
  }, [selectedSat]);

  return (
    <div className="relative w-full h-full min-h-[580px] bg-[#03060c] overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Simulation HUD Ribbon */}
      <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2 z-10 font-mono text-xs">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-950/85 border border-slate-800/90 backdrop-blur-md text-slate-200 shadow-2xl">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#06b6d4]"></span>
          <span className="font-semibold tracking-wider text-slate-100">
            {simSpeed === 1 && !isPaused ? 'REAL-TIME PROPAGATION' : `WARP (${simSpeed}×)`}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-cyan-300 tabular-nums font-medium">
            {simTime.toISOString().replace('T', ' ').substring(0, 19)} UTC
          </span>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950/85 border border-slate-800/90 backdrop-blur-md shadow-2xl">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
            title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
          </button>
          {[1, 10, 100, 1000].map(speed => (
            <button
              key={speed}
              onClick={() => { setSimSpeed(speed); setIsPaused(false); }}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                simSpeed === speed && !isPaused
                  ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {speed}×
            </button>
          ))}
          <button
            onClick={() => {
              const now = new Date();
              setSimTime(now);
              stateRef.current.simTime = now;
              setSimSpeed(1);
              setIsPaused(false);
            }}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Reset to Real-Time Now"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top Right Controls: Toggle Layers & Follow Mode */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10 font-mono text-xs">
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shadow-lg ${
            showLabels
              ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
              : 'bg-slate-950/80 text-slate-400 border-slate-800'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Names</span>
        </button>

        <button
          onClick={() => setShowOrbits(!showOrbits)}
          className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shadow-lg ${
            showOrbits
              ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
              : 'bg-slate-950/80 text-slate-400 border-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Orbits</span>
        </button>

        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shadow-lg ${
            showGrid
              ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
              : 'bg-slate-950/80 text-slate-400 border-slate-800'
          }`}
        >
          <Globe2 className="w-3.5 h-3.5" />
          <span>Grid</span>
        </button>

        {selectedSat && (
          <button
            onClick={() => setFollowCamera(!followCamera)}
            className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shadow-lg ${
              followCamera
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50 shadow-[0_0_14px_rgba(16,185,129,0.35)] animate-pulse'
                : 'bg-slate-950/80 text-slate-400 border-slate-800'
            }`}
            title="Lock camera to follow selected satellite in orbit"
          >
            <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
            <span>Follow</span>
          </button>
        )}
      </div>

      {/* Selected Satellite Mini HUD Banner (On-Globe details card) */}
      {selectedSat && (
        <div className="absolute bottom-4 left-4 z-20 max-w-sm rounded-xl bg-slate-950/90 border border-cyan-500/40 shadow-[0_10px_35px_rgba(0,0,0,0.8)] backdrop-blur-xl p-3.5 font-mono text-xs space-y-2.5 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">
                Target Acquired · {selectedSat.category}
              </span>
            </div>
            <span className="text-[10px] text-slate-500">NORAD {selectedSat.catalog_id}</span>
          </div>

          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-slate-100 font-sans tracking-tight">
                {selectedSat.name}
              </h3>
              <p className="text-[11px] text-slate-400">
                {selectedSat.intl_desig || 'NO-DESIG'} · {selectedSat.object_type}
              </p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-cyan-300 tabular-nums">
                {selectedSat.altitude_km.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-500 block">km ALT</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/60 text-slate-300">
            <div>
              <span className="text-slate-500 block text-[10px]">INCLINATION</span>
              <span className="tabular-nums font-semibold">{selectedSat.inclination.toFixed(2)}°</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">ORBIT PERIOD</span>
              <span className="tabular-nums font-semibold">{selectedSat.period_min.toFixed(1)} min</span>
            </div>
          </div>
        </div>
      )}

      {/* Hover Tooltip Card */}
      {hoveredSat && !selectedSat && (
        <div className="absolute bottom-16 left-4 z-20 p-3 rounded-lg bg-slate-950/95 border border-cyan-500/50 shadow-2xl backdrop-blur-md font-mono text-xs text-slate-200 pointer-events-none animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]"></span>
            <span className="font-bold text-slate-100 font-sans">{hoveredSat.name}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
            <span>NORAD: <strong className="text-cyan-300">{hoveredSat.catalog_id}</strong></span>
            <span>Alt: <strong className="text-slate-200">{hoveredSat.altitude_km} km</strong></span>
            <span>Inc: <strong className="text-slate-200">{hoveredSat.inclination}°</strong></span>
          </div>
          <div className="text-[10px] text-cyan-400 mt-1 font-sans">Click to inspect satellite details</div>
        </div>
      )}

      {/* Bottom Center / Right: Scientific Color Legend */}
      <div className="absolute bottom-4 right-4 hidden md:flex items-center gap-4 px-3.5 py-1.5 rounded-lg bg-slate-950/85 border border-slate-800/80 text-[11px] font-mono text-slate-400 backdrop-blur-md z-10 shadow-lg">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]"></span> Stations
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]"></span> Starlink
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]"></span> OneWeb
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]"></span> GPS / GNSS
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e]"></span> Debris
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-emerald-400 rotate-45"></span> Observer
        </span>
      </div>
    </div>
  );
};
