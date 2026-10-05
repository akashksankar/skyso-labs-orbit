import React, { useEffect, useState, useRef } from 'react';
import { Satellite, LiveTelemetry } from '../types/orbit';
import { X, Navigation2, Compass, ShieldAlert, Eye, Orbit, Zap, Share2, Sun, Moon, Copy, Check } from 'lucide-react';

interface TelemetryDrawerProps {
  satellite: Satellite | null;
  onClose: () => void;
  onViewGroundtrack: (sat: Satellite) => void;
  onViewPasses: (sat: Satellite) => void;
  onRunLab: (sat: Satellite) => void;
}

export const TelemetryDrawer: React.FC<TelemetryDrawerProps> = ({
  satellite: sat,
  onClose,
  onViewGroundtrack,
  onViewPasses,
  onRunLab,
}) => {
  const [telemetry, setTelemetry] = useState<LiveTelemetry | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [sunlit, setSunlit] = useState<boolean>(true);
  const radarCanvasRef = useRef<HTMLCanvasElement>(null);

  // Poll live telemetry
  useEffect(() => {
    if (!sat) {
      setTelemetry(null);
      return;
    }

    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`/api/objects/${sat.catalog_id}/position`);
        if (res.ok) {
          const data = await res.json();
          setTelemetry(data.telemetry);

          // Estimate illumination (Sunlit vs Earth's shadow/umbra)
          // Simplified vector dot product with Sun vector (approx sun at +X, +Z)
          const eci = data.telemetry?.eci;
          if (eci) {
            const dotSun = eci.x_km * 0.7 + eci.z_km * 0.7;
            const distFromAxis = Math.sqrt(eci.y_km * eci.y_km + (eci.x_km * -0.7 + eci.z_km * 0.7) ** 2);
            const inShadow = dotSun < 0 && distFromAxis < 6378.137;
            setSunlit(!inShadow);
          }
        }
      } catch {}
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 1000);
    return () => clearInterval(interval);
  }, [sat]);

  // Draw mini circular orbit attitude radar
  useEffect(() => {
    if (!radarCanvasRef.current || !telemetry) return;
    const canvas = radarCanvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const rOrbit = 42;

    ctx.clearRect(0, 0, w, h);

    // Dark space background
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, w, h);

    // Orbit ellipse/circle
    ctx.beginPath();
    ctx.arc(cx, cy, rOrbit, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Earth in center
    const earthGrad = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 18);
    earthGrad.addColorStop(0, '#1e40af');
    earthGrad.addColorStop(0.7, '#0f172a');
    earthGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = earthGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();

    // Earth atmosphere rim
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Satellite position along orbit
    const periodMin = sat?.period_min || 92.0;
    const timeSec = (Date.now() / 1000) % (periodMin * 60);
    const angle = (timeSec / (periodMin * 60)) * Math.PI * 2;

    const satX = cx + Math.cos(angle) * rOrbit;
    const satY = cy + Math.sin(angle) * rOrbit;

    // Glowing satellite blip
    const blipGrad = ctx.createRadialGradient(satX, satY, 1, satX, satY, 8);
    blipGrad.addColorStop(0, '#38bdf8');
    blipGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.4)');
    blipGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blipGrad;
    ctx.beginPath();
    ctx.arc(satX, satY, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(satX, satY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }, [telemetry, sat]);

  if (!sat) return null;

  const handleCopyJSON = () => {
    const jsonStr = JSON.stringify({ satellite: sat, telemetry }, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute top-16 right-4 w-96 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5.5rem)] bg-[#070b14]/95 border border-slate-800 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl z-20 flex flex-col overflow-hidden text-slate-200 animate-in slide-in-from-right duration-250">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800/90 flex items-start justify-between bg-slate-950/70">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase font-mono tracking-wider text-cyan-400 font-bold px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/40">
              {sat.category} · {sat.object_type}
            </span>
            <div className={`flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border ${
              sunlit ? 'bg-amber-950/30 text-amber-300 border-amber-800/40' : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}>
              {sunlit ? <Sun className="w-3 h-3 text-amber-400" /> : <Moon className="w-3 h-3 text-slate-400" />}
              <span>{sunlit ? 'SUNLIT' : 'UMBRA'}</span>
            </div>
          </div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight font-sans">
            {sat.name}
          </h2>
          <div className="flex items-center gap-2.5 text-xs text-slate-400 font-mono">
            <span>NORAD <strong className="text-cyan-300">{sat.catalog_id}</strong></span>
            <span>·</span>
            <span>{sat.intl_desig || 'NO-DESIG'}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors cursor-pointer"
          title="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Scrollable Content */}
      <div className="p-4 space-y-4 overflow-y-auto">
        {/* Live Radar & High-Impact Telemetry Block */}
        <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center gap-3">
          <div className="relative w-28 h-28 shrink-0 rounded-lg overflow-hidden border border-slate-800">
            <canvas ref={radarCanvasRef} width={112} height={112} className="w-full h-full" />
            <span className="absolute bottom-1 right-1.5 text-[9px] font-mono text-cyan-400/80 font-bold">
              ORBIT GAUGE
            </span>
          </div>

          <div className="flex-1 space-y-2 font-mono">
            <div>
              <span className="text-[10px] uppercase text-slate-500 block">Altitude (WGS84)</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-cyan-300 tabular-nums">
                  {telemetry ? telemetry.coordinates.altitude_km.toFixed(1) : sat.altitude_km.toFixed(1)}
                </span>
                <span className="text-xs text-slate-400">km</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase text-slate-500 block">Orbital Velocity</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-100 tabular-nums">
                  {telemetry ? telemetry.coordinates.speed_kms.toFixed(3) : '7.660'}
                </span>
                <span className="text-xs text-slate-400">km/s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Coordinates */}
        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/70">
            <span className="text-[10px] text-slate-500 uppercase block">Latitude</span>
            <span className="text-sm font-semibold text-slate-200 tabular-nums">
              {telemetry ? `${Math.abs(telemetry.coordinates.latitude_deg).toFixed(4)}° ${telemetry.coordinates.latitude_deg >= 0 ? 'N' : 'S'}` : '0.0000° N'}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/70">
            <span className="text-[10px] text-slate-500 uppercase block">Longitude</span>
            <span className="text-sm font-semibold text-slate-200 tabular-nums">
              {telemetry ? `${Math.abs(telemetry.coordinates.longitude_deg).toFixed(4)}° ${telemetry.coordinates.longitude_deg >= 0 ? 'E' : 'W'}` : '0.0000° E'}
            </span>
          </div>
        </div>

        {/* Topocentric Observer Station Look Angles */}
        {telemetry?.observer_view && (
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-2 font-mono">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px] uppercase font-bold flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                Observer Look Angles
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                telemetry.observer_view.is_visible
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {telemetry.observer_view.is_visible ? 'IN LINE OF SIGHT' : 'BELOW HORIZON'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs pt-1">
              <div>
                <span className="text-[10px] text-slate-500 block">Azimuth</span>
                <span className="font-semibold text-slate-200 tabular-nums">
                  {telemetry.observer_view.azimuth_deg.toFixed(1)}°
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Elevation</span>
                <span className={`font-semibold tabular-nums ${telemetry.observer_view.elevation_deg > 0 ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                  {telemetry.observer_view.elevation_deg.toFixed(1)}°
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Slant Range</span>
                <span className="font-semibold text-slate-200 tabular-nums">
                  {telemetry.observer_view.range_km.toFixed(0)} km
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Keplerian Elements Table */}
        <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800/80 space-y-1.5 font-mono text-xs">
          <div className="text-[11px] font-bold uppercase text-slate-400 mb-2">
            Keplerian Orbital Elements
          </div>
          <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
            <span className="text-slate-400">Inclination</span>
            <span className="font-semibold text-slate-200 tabular-nums">{sat.inclination.toFixed(4)}°</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
            <span className="text-slate-400">Eccentricity</span>
            <span className="font-semibold text-slate-200 tabular-nums">{sat.eccentricity.toFixed(7)}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
            <span className="text-slate-400">Mean Motion</span>
            <span className="font-semibold text-slate-200 tabular-nums">{sat.mean_motion.toFixed(6)} rev/day</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
            <span className="text-slate-400">Orbital Period</span>
            <span className="font-semibold text-slate-200 tabular-nums">{sat.period_min.toFixed(2)} min</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-400">Semi-Major Axis</span>
            <span className="font-semibold text-slate-200 tabular-nums">{(sat.altitude_km + 6378.137).toFixed(1)} km</span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="space-y-2 pt-1 font-mono text-xs">
          <button
            onClick={() => onViewGroundtrack(sat)}
            className="w-full py-2.5 px-3 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.15)]"
          >
            <Orbit className="w-4 h-4" />
            <span>Display Ground Track</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onViewPasses(sat)}
              className="py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>Predict Passes</span>
            </button>
            <button
              onClick={() => onRunLab(sat)}
              className="py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Lab Analysis</span>
            </button>
          </div>

          <button
            onClick={handleCopyJSON}
            className="w-full py-1.5 rounded bg-slate-950/60 hover:bg-slate-900 border border-slate-800 text-[11px] text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied Telemetry to Clipboard' : 'Copy Telemetry Data (JSON)'}</span>
          </button>
        </div>

        {/* Scientific Traceability */}
        <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800/80 text-[10px] font-mono text-slate-500 space-y-1">
          <div className="text-slate-400 font-bold uppercase tracking-wider">Scientific Provenance</div>
          <div>Ephemeris Source: <span className="text-slate-300">{sat.source}</span></div>
          <div>Propagation Theory: <span className="text-slate-300">SGP4 (SDP4 Spacetrack #3)</span></div>
          <div>Epoch Timestamp: <span className="text-slate-300">{sat.epoch || 'NOMINAL'}</span></div>
        </div>
      </div>
    </div>
  );
};
