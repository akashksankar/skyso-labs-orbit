import React, { useState } from 'react';
import { Satellite, ConjunctionResult, PropagationExperimentResult } from '../types/orbit';
import { FlaskConical, ShieldAlert, Cpu, Download, Sparkles, BookOpen, AlertTriangle } from 'lucide-react';

interface ResearchLabViewProps {
  satellites: Satellite[];
  selectedSat: Satellite | null;
}

export const ResearchLabView: React.FC<ResearchLabViewProps> = ({ satellites, selectedSat }) => {
  const [activeLabTab, setActiveLabTab] = useState<'conjunction' | 'propagation' | 'mechanics'>('conjunction');

  // Conjunction state
  const [satAId, setSatAId] = useState<string>(selectedSat ? selectedSat.catalog_id : '25544');
  const [satBId, setSatBId] = useState<string>('33443'); // Cosmos debris default
  const [durationHours, setDurationHours] = useState<number>(24);
  const [conjunctionResult, setConjunctionResult] = useState<ConjunctionResult | null>(null);
  const [conjunctionLoading, setConjunctionLoading] = useState<boolean>(false);

  // Propagation Experiment state
  const [propTargetId, setPropTargetId] = useState<string>(selectedSat ? selectedSat.catalog_id : '25544');
  const [propResult, setPropResult] = useState<PropagationExperimentResult | null>(null);
  const [propLoading, setPropLoading] = useState<boolean>(false);

  // Run Conjunction Analysis
  const handleRunConjunction = async () => {
    setConjunctionLoading(true);
    try {
      const res = await fetch('/api/analysis/conjunction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sat_id_a: satAId, sat_id_b: satBId, duration_hours: durationHours })
      });
      if (res.ok) {
        const json = await res.json();
        setConjunctionResult(json);
      }
    } catch {}
    setConjunctionLoading(false);
  };

  // Run Propagation Experiment
  const handleRunPropagation = async () => {
    setPropLoading(true);
    try {
      const res = await fetch('/api/analysis/propagation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sat_id: propTargetId, horizons: [1, 6, 12, 24, 48] })
      });
      if (res.ok) {
        const json = await res.json();
        setPropResult(json);
      }
    } catch {}
    setPropLoading(false);
  };

  // Export Propagation Results
  const exportPropMarkdown = () => {
    if (!propResult) return;
    const md = `# ${propResult.experiment_name}\n\n` +
      `**Satellite:** ${propResult.satellite.name} (${propResult.satellite.catalog_id})\n` +
      `**Engine:** ${propResult.engine}\n` +
      `**Reference Epoch:** ${propResult.reference_epoch}\n\n` +
      `| Horizon | Target UTC | SGP4 Alt (km) | Velocity (km/s) | J2 Secular Drift (km) | Semi-Major Axis (km) |\n` +
      `|---|---|---|---|---|---|\n` +
      propResult.results.map(r => `| ${r.horizon_hours}h | ${r.target_time} | ${r.sgp4_altitude_km} | ${r.sgp4_speed_kms} | ${r.estimated_j2_perturbation_drift_km} | ${r.semi_major_axis_km} |`).join('\n');

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orbit_experiment_${propResult.satellite.catalog_id}.md`;
    a.click();
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Title */}
      <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-mono tracking-wider text-cyan-400 font-semibold block">
            Astrodynamics &amp; Space Flight Mechanics
          </span>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight mt-0.5">
            ORBIT Research Laboratory
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Empirical close-approach conjunction modeling, secular perturbation drift experiments, and orbital mechanics reference.
          </p>
        </div>

        {/* Lab Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
          <button
            onClick={() => setActiveLabTab('conjunction')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeLabTab === 'conjunction'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Conjunction Assessment
          </button>
          <button
            onClick={() => setActiveLabTab('propagation')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeLabTab === 'propagation'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Propagation Sensitivity
          </button>
          <button
            onClick={() => setActiveLabTab('mechanics')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeLabTab === 'mechanics'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mechanics Reference
          </button>
        </div>
      </div>

      {/* Tab 1: Conjunction Assessment */}
      {activeLabTab === 'conjunction' && (
        <div className="space-y-6">
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>NON-OPERATIONAL RESEARCH ESTIMATE:</strong> Conjunction calculations use publicly available two-line element sets (TLE/OMM). This research tool does not replace official conjunction assessment warnings issued by 18th Space Defense Squadron or satellite operators.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Setup Form */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4 font-mono text-xs">
              <h2 className="text-sm font-bold text-slate-200 uppercase flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                Conjunction Parameters
              </h2>

              <div>
                <label className="text-slate-400 block mb-1">Primary Object (Object A)</label>
                <select
                  value={satAId}
                  onChange={e => setSatAId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  {satellites.map(s => (
                    <option key={s.catalog_id} value={s.catalog_id}>
                      {s.name} ({s.catalog_id}) · {s.category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Secondary Object (Object B)</label>
                <select
                  value={satBId}
                  onChange={e => setSatBId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  {satellites.map(s => (
                    <option key={s.catalog_id} value={s.catalog_id}>
                      {s.name} ({s.catalog_id}) · {s.object_type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Horizon: {durationHours} Hours</label>
                <input
                  type="range"
                  min="6"
                  max="72"
                  step="6"
                  value={durationHours}
                  onChange={e => setDurationHours(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <button
                onClick={handleRunConjunction}
                disabled={conjunctionLoading}
                className="w-full py-2.5 rounded bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-bold transition-colors cursor-pointer"
              >
                {conjunctionLoading ? 'Evaluating Trajectories...' : 'Execute Conjunction Run'}
              </button>
            </div>

            {/* Results Display */}
            <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4">
              <h2 className="text-sm font-bold text-slate-200 uppercase font-mono flex items-center justify-between">
                <span>Assessment Findings</span>
                {conjunctionResult && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {conjunctionResult.confidence}
                  </span>
                )}
              </h2>

              {!conjunctionResult ? (
                <div className="py-16 text-center text-slate-500 font-mono text-xs">
                  Configure orbital targets and click "Execute Conjunction Run" to calculate minimum separation distance and Time of Closest Approach.
                </div>
              ) : (
                <div className="space-y-4 font-mono">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">Min Separation</span>
                      <span className={`text-2xl font-bold tabular-nums ${
                        conjunctionResult.minimum_separation_km < 10 ? 'text-rose-400' : 'text-cyan-300'
                      }`}>
                        {conjunctionResult.minimum_separation_km.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">km</span>
                    </div>

                    <div className="p-3 rounded bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">Relative Speed</span>
                      <span className="text-2xl font-bold text-slate-100 tabular-nums">
                        {conjunctionResult.relative_velocity_kms.toFixed(3)}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">km/s</span>
                    </div>

                    <div className="p-3 rounded bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">Risk Classification</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded inline-block mt-2 ${
                        conjunctionResult.risk_level === 'ELEVATED'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {conjunctionResult.risk_level}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                    <div className="text-slate-400">
                      Time of Closest Approach (TCA): <strong className="text-slate-100">{conjunctionResult.time_of_closest_approach_utc}</strong>
                    </div>
                    <div className="text-slate-400">
                      Target Pair: <span className="text-cyan-300">{conjunctionResult.object_a.name}</span> &times; <span className="text-rose-300">{conjunctionResult.object_b.name}</span>
                    </div>
                    <div className="text-slate-500 text-[10px] italic">
                      Relative velocity vector computed via SGP4 ECI state differentiation: &Delta;v = |v_A - v_B|.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Propagation Sensitivity Experiment */}
      {activeLabTab === 'propagation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Control Column */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4 font-mono text-xs">
              <h2 className="text-sm font-bold text-slate-200 uppercase flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Experiment Setup
              </h2>

              <div>
                <label className="text-slate-400 block mb-1">Target Spacecraft</label>
                <select
                  value={propTargetId}
                  onChange={e => setPropTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  {satellites.map(s => (
                    <option key={s.catalog_id} value={s.catalog_id}>
                      {s.name} ({s.catalog_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-slate-400 text-[11px] leading-relaxed">
                Evaluates SGP4 orbital propagation against analytical secular perturbations, measuring J2 nodal regression and atmospheric drag degradation across 1h, 6h, 12h, 24h, and 48h horizons.
              </div>

              <button
                onClick={handleRunPropagation}
                disabled={propLoading}
                className="w-full py-2.5 rounded bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-bold transition-colors cursor-pointer"
              >
                {propLoading ? 'Propagating Orbit...' : 'Run Propagation Experiment'}
              </button>
            </div>

            {/* Results Column */}
            <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-slate-200 uppercase font-mono">
                  Experiment Results
                </h2>
                {propResult && (
                  <button
                    onClick={exportPropMarkdown}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Export Markdown</span>
                  </button>
                )}
              </div>

              {!propResult ? (
                <div className="py-16 text-center text-slate-500 font-mono text-xs">
                  Click "Run Propagation Experiment" to benchmark orbital decay and perturbation divergence.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Horizon</th>
                        <th className="py-2.5 px-3">Target Time</th>
                        <th className="py-2.5 px-3 text-right">Altitude (km)</th>
                        <th className="py-2.5 px-3 text-right">Speed (km/s)</th>
                        <th className="py-2.5 px-3 text-right">J2 Perturbation Drift</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {propResult.results.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-bold text-cyan-400 tabular-nums">{r.horizon_hours}h</td>
                          <td className="py-2.5 px-3 text-slate-300">{r.target_time}</td>
                          <td className="py-2.5 px-3 text-right text-slate-100 tabular-nums">{r.sgp4_altitude_km.toFixed(1)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-100 tabular-nums">{r.sgp4_speed_kms.toFixed(3)}</td>
                          <td className="py-2.5 px-3 text-right text-amber-300 tabular-nums">{r.estimated_j2_perturbation_drift_km.toFixed(2)} km</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Mechanics Reference */}
      {activeLabTab === 'mechanics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
            <h3 className="text-sm font-bold text-cyan-400 uppercase flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Sun-Synchronous Orbit (SSO)
            </h3>
            <p className="text-slate-300 leading-relaxed font-sans">
              An orbit whose ascending node precesses at exactly the same rate that Earth orbits the Sun (~0.9856°/day). Achieved by setting orbital inclination to around 96°–98° for LEO altitudes, causing Earth's equatorial oblateness ($J_2$) to torque the orbital plane.
            </p>
            <div className="p-2 rounded bg-slate-950 text-slate-400 text-[11px]">
              Formula: &Delta;&Omega; = -1.5 n J2 (RE/a)^2 cos(i)
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
            <h3 className="text-sm font-bold text-cyan-400 uppercase flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Critical Inclination (Molniya Orbits)
            </h3>
            <p className="text-slate-300 leading-relaxed font-sans">
              At the critical inclination of i = 63.435° or 116.565°, the term (5 cos² i - 1) vanishes, freezing the secular rotation of the argument of perigee (dω/dt = 0). This allows highly elliptical orbits to keep their apogee parked over high northern latitudes.
            </p>
            <div className="p-2 rounded bg-slate-950 text-slate-400 text-[11px]">
              Condition: 5 cos²(i) - 1 = 0 &rarr; i &approx; 63.435°
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
            <h3 className="text-sm font-bold text-cyan-400 uppercase flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              SGP4 / SDP4 Ephemeris Model
            </h3>
            <p className="text-slate-300 leading-relaxed font-sans">
              Simplified General Perturbations-4 (SGP4) analytically propagates orbits using two-line element sets (TLEs). It models Earth gravitational harmonics (J2, J3, J4), atmospheric drag using the BSTAR parameter, and solar/lunar third-body gravitational resonance for deep space objects (P &gt; 225 min).
            </p>
            <div className="p-2 rounded bg-slate-950 text-slate-400 text-[11px]">
              Accuracy: ~1 km at epoch; degrades ~1-3 km/day depending on solar flux.
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
            <h3 className="text-sm font-bold text-cyan-400 uppercase flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Geostationary Belt Geometry
            </h3>
            <p className="text-slate-300 leading-relaxed font-sans">
              A circular orbit directly above Earth's equator (i = 0°) with an orbital period precisely equal to one sidereal day (T = 86,164.1 s). The semi-major axis is a &approx; 42,164 km, yielding an altitude of 35,786 km above the mean equatorial radius.
            </p>
            <div className="p-2 rounded bg-slate-950 text-slate-400 text-[11px]">
              Orbital Speed: v &approx; 3.075 km/s
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
