import React, { useEffect, useState } from 'react';
import { AnalyticsData, Satellite } from '../types/orbit';
import { BarChart3, PieChart, ShieldAlert, ArrowUpRight, Download, RefreshCw } from 'lucide-react';

interface AnalyticsViewProps {
  satellites: Satellite[];
  onSelectSatellite: (sat: Satellite) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ satellites, onSelectSatellite }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/population');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const debrisSats = satellites.filter(s => s.object_type === 'DEBRIS' || s.category === 'Debris');

  const maxAltCount = data?.altitude_distribution ? Math.max(...data.altitude_distribution.map(d => d.count), 1) : 1;
  const maxIncCount = data?.inclination_distribution ? Math.max(...data.inclination_distribution.map(d => d.count), 1) : 1;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Title */}
      <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-mono tracking-wider text-cyan-400 font-semibold block">
            Population Metrics &amp; Space Situational Awareness
          </span>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight mt-0.5">
            Orbital Analytics &amp; Debris Explorer
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Empirical distributions across altitude regimes, orbital inclinations, and derelict space debris populations.
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <span className="text-xs text-slate-500 uppercase block mb-1">Total Tracked</span>
          <span className="text-2xl font-bold text-slate-100 tabular-nums">
            {data?.total_tracked || satellites.length}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">Objects cataloged</span>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <span className="text-xs text-slate-500 uppercase block mb-1">LEO Regimes (&lt;2000 km)</span>
          <span className="text-2xl font-bold text-cyan-400 tabular-nums">
            {data?.regimes.LEO || 0}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">High density region</span>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <span className="text-xs text-slate-500 uppercase block mb-1">MEO / GEO Regimes</span>
          <span className="text-2xl font-bold text-amber-400 tabular-nums">
            {(data?.regimes.MEO || 0) + (data?.regimes.GEO || 0)}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">GNSS &amp; Geostationary</span>
        </div>

        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <span className="text-xs text-slate-500 uppercase block mb-1">Tracked Debris</span>
          <span className="text-2xl font-bold text-rose-400 tabular-nums">
            {data?.object_types.DEBRIS || debrisSats.length}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">Fragments &amp; Derelicts</span>
        </div>
      </div>

      {/* Histograms Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Altitude Distribution Chart */}
        <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-bold text-slate-200 uppercase font-mono flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              Altitude Distribution
            </h2>
            <span className="text-xs font-mono text-slate-500">Perigee/Apogee Bins</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {data?.altitude_distribution.map((item, idx) => {
              const pct = (item.count / maxAltCount) * 100;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-slate-300 text-[11px]">
                    <span>{item.range}</span>
                    <span className="font-bold text-cyan-300 tabular-nums">{item.count}</span>
                  </div>
                  <div className="w-full h-2 rounded bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 rounded transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Inclination Distribution Chart */}
        <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-bold text-slate-200 uppercase font-mono flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              Inclination Distribution
            </h2>
            <span className="text-xs font-mono text-slate-500">Equatorial to Polar / Retrograde</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {data?.inclination_distribution.map((item, idx) => {
              const pct = (item.count / maxIncCount) * 100;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-slate-300 text-[11px]">
                    <span>{item.range}</span>
                    <span className="font-bold text-amber-300 tabular-nums">{item.count}</span>
                  </div>
                  <div className="w-full h-2 rounded bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Debris Explorer Section */}
      <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-200 uppercase font-mono flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Space Debris Population &amp; High-Risk Derelicts
            </h2>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Empirical tracking of known fragmentation events (Iridium 33 / Cosmos 2251, Fengyun 1C ASAT) and derelict spacecraft.
            </p>
          </div>
          <span className="text-[11px] font-mono px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 whitespace-nowrap">
            RESEARCH PURPOSE ONLY
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {debrisSats.map(sat => (
            <div
              key={sat.catalog_id}
              onClick={() => onSelectSatellite(sat)}
              className="p-4 rounded-lg bg-slate-950/80 border border-rose-950/40 hover:border-rose-500/50 transition-colors cursor-pointer space-y-2 group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono text-rose-400 font-bold block">
                    NORAD {sat.catalog_id} · {sat.intl_desig}
                  </span>
                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-rose-300 transition-colors">
                    {sat.name}
                  </h3>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 transition-colors" />
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">
                {sat.description}
              </p>
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between font-mono text-[11px] text-slate-300">
                <span>Altitude: <strong className="text-slate-100 tabular-nums">{sat.altitude_km} km</strong></span>
                <span>Inc: <strong className="text-slate-100 tabular-nums">{sat.inclination}°</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
