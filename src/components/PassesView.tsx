import React, { useState, useEffect } from 'react';
import { Satellite, ObserverConfig, PassItem } from '../types/orbit';
import { MapPin, Compass, Eye, ShieldCheck, RefreshCw, Radio } from 'lucide-react';

interface PassesViewProps {
  satellites: Satellite[];
  selectedSat: Satellite | null;
  onSelectSatellite: (sat: Satellite) => void;
  observer: ObserverConfig;
  onUpdateObserver: (obs: ObserverConfig) => void;
}

const PRESET_STATIONS: { name: string; lat: number; lon: number; alt: number }[] = [
  { name: "Kennedy Space Center (Cape Canaveral, FL)", lat: 28.5721, lon: -80.6480, alt: 10 },
  { name: "Guiana Space Centre (Kourou, French Guiana)", lat: 5.2372, lon: -52.7606, alt: 15 },
  { name: "Baikonur Cosmodrome (Kazakhstan)", lat: 45.9646, lon: 63.3052, alt: 90 },
  { name: "Svalbard Satellite Station (SvalSat, Norway)", lat: 78.2298, lon: 15.4078, alt: 450 },
  { name: "Tokyo Satellite Tracking Center (Japan)", lat: 35.6762, lon: 139.6503, alt: 40 },
  { name: "London Observatory (Greenwich, UK)", lat: 51.4769, lon: -0.0005, alt: 48 }
];

export const PassesView: React.FC<PassesViewProps> = ({
  satellites,
  selectedSat,
  onSelectSatellite,
  observer,
  onUpdateObserver
}) => {
  const [targetSatId, setTargetSatId] = useState<string>(selectedSat ? selectedSat.catalog_id : '25544');
  const [passes, setPasses] = useState<PassItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [minElevation, setMinElevation] = useState<number>(observer.min_elevation_deg || 10);

  // Form states for ground station
  const [stationName, setStationName] = useState(observer.name);
  const [stationLat, setStationLat] = useState(observer.latitude.toString());
  const [stationLon, setStationLon] = useState(observer.longitude.toString());
  const [stationAlt, setStationAlt] = useState(observer.altitude_m.toString());

  const currentSat = satellites.find(s => s.catalog_id === targetSatId) || satellites[0];

  const fetchPasses = async (satId: string, minEl: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/objects/${satId}/passes?min_elevation=${minEl}&days=2.5&limit=6`);
      if (res.ok) {
        const data = await res.json();
        setPasses(data.passes || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (selectedSat) {
      setTargetSatId(selectedSat.catalog_id);
    }
  }, [selectedSat]);

  useEffect(() => {
    if (targetSatId) {
      fetchPasses(targetSatId, minElevation);
    }
  }, [targetSatId, minElevation, observer]);

  const handleSaveObserver = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(stationLat);
    const lon = parseFloat(stationLon);
    const alt = parseFloat(stationAlt);
    if (isNaN(lat) || isNaN(lon)) return;

    const newConfig: ObserverConfig = {
      name: stationName,
      latitude: lat,
      longitude: lon,
      altitude_m: isNaN(alt) ? 10 : alt,
      min_elevation_deg: minElevation
    };

    try {
      const res = await fetch('/api/observer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (res.ok) {
        onUpdateObserver(newConfig);
      }
    } catch {}
  };

  const handleApplyPreset = (p: typeof PRESET_STATIONS[0]) => {
    setStationName(p.name);
    setStationLat(p.lat.toString());
    setStationLon(p.lon.toString());
    setStationAlt(p.alt.toString());
    onUpdateObserver({
      name: p.name,
      latitude: p.lat,
      longitude: p.lon,
      altitude_m: p.alt,
      min_elevation_deg: minElevation
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Title */}
      <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-mono tracking-wider text-cyan-400 font-semibold block">
            Topocentric Observation
          </span>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight mt-0.5">
            Pass Prediction &amp; Look Angles
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Calculate Acquisition of Signal (AOS), Time of Closest Approach (TCA), and Loss of Signal (LOS).
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Local Processing · No Location Leaks</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Observer Ground Station Configuration */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase font-mono flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" />
              Observer Ground Station
            </h2>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1.5 uppercase">
              Global Station Presets
            </label>
            <div className="space-y-1">
              {PRESET_STATIONS.map(p => (
                <button
                  key={p.name}
                  onClick={() => handleApplyPreset(p)}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-mono transition-colors truncate ${
                    observer.name === p.name
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Manual Coordinates Form */}
          <form onSubmit={handleSaveObserver} className="space-y-3 font-mono text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Station Name</label>
              <input
                type="text"
                value={stationName}
                onChange={e => setStationName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 block mb-1">Latitude (°)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={stationLat}
                  onChange={e => setStationLat(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-cyan-500 tabular-nums"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Longitude (°)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={stationLon}
                  onChange={e => setStationLon(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-cyan-500 tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Elevation Mask ({minElevation}°)</label>
              <input
                type="range"
                min="0"
                max="45"
                step="5"
                value={minElevation}
                onChange={e => setMinElevation(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-semibold transition-colors cursor-pointer"
            >
              Update Ground Station
            </button>
          </form>
        </div>

        {/* Right Column (2 cols): Target Selection + Upcoming Passes Table */}
        <div className="lg:col-span-2 space-y-5">
          {/* Target Satellite Selector Bar */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                Target Satellite
              </label>
              <select
                value={targetSatId}
                onChange={(e) => setTargetSatId(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-sm text-cyan-300 font-mono font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                {satellites.map(s => (
                  <option key={s.catalog_id} value={s.catalog_id}>
                    {s.name} ({s.catalog_id}) · {s.category}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => fetchPasses(targetSatId, minElevation)}
              disabled={loading}
              className="px-4 py-2 rounded bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Recalculate Passes</span>
            </button>
          </div>

          {/* Passes List */}
          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40">
            <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200 font-mono">
                Upcoming Passes for {currentSat?.name} (Next 48 Hours)
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                Min Elevation: {minElevation}°
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">AOS (Rise)</th>
                    <th className="py-3 px-4">Rise Azimuth</th>
                    <th className="py-3 px-4">Max Elevation</th>
                    <th className="py-3 px-4">LOS (Set)</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Visibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Propagating SGP4 trajectory over horizon...
                      </td>
                    </tr>
                  ) : passes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                        No passes above {minElevation}° found for {currentSat?.name} in the next 48 hours. Try lowering the elevation mask.
                      </td>
                    </tr>
                  ) : (
                    passes.map((p, idx) => {
                      const riseDt = new Date(p.rise_time);
                      const setDt = new Date(p.set_time);
                      return (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-cyan-400 tabular-nums">
                            {riseDt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                            <span className="text-slate-100">{riseDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          </td>
                          <td className="py-3.5 px-4 tabular-nums text-slate-300">
                            {p.rise_azimuth_deg.toFixed(1)}°
                          </td>
                          <td className="py-3.5 px-4 tabular-nums">
                            <span className={`px-2 py-0.5 rounded font-bold ${
                              p.max_elevation_deg >= 60
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : p.max_elevation_deg >= 30
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {p.max_elevation_deg.toFixed(1)}°
                            </span>
                          </td>
                          <td className="py-3.5 px-4 tabular-nums text-slate-300">
                            {setDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ({p.set_azimuth_deg.toFixed(0)}°)
                          </td>
                          <td className="py-3.5 px-4 tabular-nums text-yellow-300 font-semibold">
                            {p.duration_formatted}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-slate-300 font-medium">
                              {p.visibility}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
