import React, { useState, useMemo } from 'react';
import { Satellite } from '../types/orbit';
import {
  Search,
  Download,
  Orbit,
  Eye,
  Zap,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Layers,
  List,
  Radio,
  ShieldAlert,
  Globe2,
  Compass,
  CheckSquare,
  Square,
  Sparkles,
  ExternalLink,
  ChevronUp
} from 'lucide-react';

interface CatalogViewProps {
  satellites: Satellite[];
  onSelectSatellite: (sat: Satellite) => void;
  onViewPasses: (sat: Satellite) => void;
  onRunLab: (sat: Satellite) => void;
}

interface ConstellationGroup {
  id: string;
  name: string;
  shortName: string;
  operator: string;
  icon: React.ComponentType<{ className?: string }>;
  statusText: string;
  statusColor: string;
  description: string;
  colorScheme: {
    accent: string;
    border: string;
    bg: string;
    badge: string;
    chipBg: string;
    glow: string;
  };
  filterMatch: (s: Satellite) => boolean;
}

const CONSTELLATION_DEFINITIONS: ConstellationGroup[] = [
  {
    id: 'starlink',
    name: 'Starlink Mega-Constellation',
    shortName: 'Starlink',
    operator: 'SpaceX',
    icon: Orbit,
    statusText: 'ACTIVE MEGA-CONSTELLATION',
    statusColor: 'text-cyan-400',
    description: 'Commercial low-latency broadband mega-constellation operating in 540–550 km circular LEO shells with optical inter-satellite laser crosslinks.',
    colorScheme: {
      accent: 'text-cyan-400',
      border: 'border-cyan-500/30',
      bg: 'bg-cyan-950/15',
      badge: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
      chipBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20',
      glow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]'
    },
    filterMatch: (s) => s.category.toLowerCase().includes('starlink') || s.name.toUpperCase().startsWith('STARLINK')
  },
  {
    id: 'oneweb',
    name: 'OneWeb Global Constellation',
    shortName: 'OneWeb',
    operator: 'Eutelsat OneWeb',
    icon: Radio,
    statusText: 'POLAR HIGH-INCLINATION FLEET',
    statusColor: 'text-indigo-400',
    description: 'High-inclination 87.4° polar LEO network providing Ku/Ka-band global connectivity across arctic, maritime, enterprise, and aviation corridors.',
    colorScheme: {
      accent: 'text-indigo-400',
      border: 'border-indigo-500/30',
      bg: 'bg-indigo-950/15',
      badge: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
      chipBg: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20',
      glow: 'shadow-[0_0_15px_rgba(99,102,241,0.15)]'
    },
    filterMatch: (s) => s.category.toLowerCase().includes('oneweb') || s.name.toUpperCase().startsWith('ONEWEB')
  },
  {
    id: 'stations',
    name: 'Space Stations (Human Habitats)',
    shortName: 'Stations',
    operator: 'International Consortium & CMSA',
    icon: Layers,
    statusText: 'PERMANENTLY CREWED RESEARCH',
    statusColor: 'text-emerald-400',
    description: 'Permanently crewed microgravity orbital research complexes including the International Space Station (ISS) and Chinese Tiangong CSS.',
    colorScheme: {
      accent: 'text-emerald-400',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-950/15',
      badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      chipBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]'
    },
    filterMatch: (s) => s.category.toLowerCase().includes('stations') || s.catalog_id === '25544' || s.catalog_id === '48274'
  },
  {
    id: 'gnss',
    name: 'Global Navigation Systems (GNSS)',
    shortName: 'GNSS / GPS',
    operator: 'US Space Force & European Union / ESA',
    icon: Compass,
    statusText: 'MEDIUM EARTH ORBIT (MEO) PNT',
    statusColor: 'text-amber-400',
    description: 'Semi-synchronous 12-hour MEO atomic clock constellations providing global Position, Navigation, and Timing (GPS & Galileo).',
    colorScheme: {
      accent: 'text-amber-400',
      border: 'border-amber-500/30',
      bg: 'bg-amber-950/15',
      badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
      chipBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]'
    },
    filterMatch: (s) => s.category.toLowerCase().includes('navigation') || s.name.toUpperCase().startsWith('GPS') || s.name.toUpperCase().startsWith('GALILEO')
  },
  {
    id: 'earth_science',
    name: 'Earth Observation & Astrophysics',
    shortName: 'Science',
    operator: 'NASA / USGS / NOAA',
    icon: Globe2,
    statusText: 'SUN-SYNCHRONOUS OBSERVATION',
    statusColor: 'text-sky-400',
    description: 'High-resolution multispectral optical observation, atmospheric monitoring, and space telescope astronomy (HST, Landsat, Terra, Suomi NPP).',
    colorScheme: {
      accent: 'text-sky-400',
      border: 'border-sky-500/30',
      bg: 'bg-sky-950/15',
      badge: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
      chipBg: 'bg-sky-500/10 text-sky-300 border-sky-500/30 hover:bg-sky-500/20',
      glow: 'shadow-[0_0_15px_rgba(56,189,248,0.15)]'
    },
    filterMatch: (s) => s.category.toLowerCase().includes('science') || s.category.toLowerCase().includes('earth') || s.catalog_id === '20580'
  },
  {
    id: 'debris',
    name: 'Tracked Orbital Debris & Derelicts',
    shortName: 'Debris',
    operator: 'Space Surveillance Network (Tracked Fragments)',
    icon: ShieldAlert,
    statusText: 'COLLISION HAZARD MONITORING',
    statusColor: 'text-rose-400',
    description: 'Tracked derelict spacecraft and fragments from historical kinetic collisions (Cosmos 2251, Fengyun-1C, Envisat) monitored for conjunction risk.',
    colorScheme: {
      accent: 'text-rose-400',
      border: 'border-rose-500/30',
      bg: 'bg-rose-950/15',
      badge: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
      chipBg: 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20',
      glow: 'shadow-[0_0_15px_rgba(244,63,94,0.15)]'
    },
    filterMatch: (s) => s.object_type === 'DEBRIS' || s.category.toLowerCase().includes('debris') || s.name.toUpperCase().includes('DEBRIS')
  }
];

export const CatalogView: React.FC<CatalogViewProps> = ({
  satellites,
  onSelectSatellite,
  onViewPasses,
  onRunLab
}) => {
  const [search, setSearch] = useState('');
  const [selectedRegime, setSelectedRegime] = useState('ALL');
  const [selectedConstellationChip, setSelectedConstellationChip] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'constellations' | 'flat'>('constellations');
  const [sortBy, setSortBy] = useState<'name' | 'altitude' | 'inclination' | 'id'>('name');

  // Track collapsed/expanded state of each constellation section
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    debris: false // All expanded by default
  });

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const expandAll = () => setCollapsedGroups({});
  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    CONSTELLATION_DEFINITIONS.forEach(c => { allCollapsed[c.id] = true; });
    allCollapsed['other'] = true;
    setCollapsedGroups(allCollapsed);
  };

  // Base filtered satellite list (matching search query and regime)
  const filteredSatellites = useMemo(() => {
    return satellites.filter(s => {
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchId = s.catalog_id.includes(q);
        const matchDesig = (s.intl_desig || '').toLowerCase().includes(q);
        const matchCategory = s.category.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchDesig && !matchCategory) return false;
      }

      // Regime filter
      const alt = s.altitude_km;
      if (selectedRegime === 'LEO' && alt >= 2000) return false;
      if (selectedRegime === 'MEO' && (alt < 2000 || alt > 35000)) return false;
      if (selectedRegime === 'GEO' && (alt < 35000 || alt > 36500)) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'altitude') return a.altitude_km - b.altitude_km;
      if (sortBy === 'inclination') return a.inclination - b.inclination;
      if (sortBy === 'id') return parseInt(a.catalog_id) - parseInt(b.catalog_id);
      return a.name.localeCompare(b.name);
    });
  }, [satellites, search, selectedRegime, sortBy]);

  // Group filtered satellites by constellation
  const constellationSections = useMemo(() => {
    const assignedIds = new Set<string>();

    const sections = CONSTELLATION_DEFINITIONS.map(def => {
      const items = filteredSatellites.filter(s => {
        if (def.filterMatch(s)) {
          assignedIds.add(s.catalog_id);
          return true;
        }
        return false;
      });

      const count = items.length;
      const avgAlt = count > 0 ? items.reduce((acc, s) => acc + s.altitude_km, 0) / count : 0;
      const avgInc = count > 0 ? items.reduce((acc, s) => acc + s.inclination, 0) / count : 0;

      return {
        ...def,
        items,
        count,
        avgAlt,
        avgInc
      };
    });

    // Unclassified auxiliary satellites
    const unclassified = filteredSatellites.filter(s => !assignedIds.has(s.catalog_id));
    if (unclassified.length > 0) {
      const avgAlt = unclassified.reduce((acc, s) => acc + s.altitude_km, 0) / unclassified.length;
      const avgInc = unclassified.reduce((acc, s) => acc + s.inclination, 0) / unclassified.length;
      sections.push({
        id: 'other',
        name: 'General & Supplementary Payloads',
        shortName: 'Other',
        operator: 'Various Space Agencies',
        icon: Orbit,
        statusText: 'AUXILIARY PAYLOADS',
        statusColor: 'text-slate-400',
        description: 'Auxiliary satellites and special mission payloads cataloged in local SQLite cache.',
        colorScheme: {
          accent: 'text-slate-300',
          border: 'border-slate-800',
          bg: 'bg-slate-900/30',
          badge: 'bg-slate-800 text-slate-300',
          chipBg: 'bg-slate-800/40 text-slate-400 border-slate-700 hover:bg-slate-800',
          glow: ''
        },
        filterMatch: () => true,
        items: unclassified,
        count: unclassified.length,
        avgAlt,
        avgInc
      });
    }

    // Apply quick chip filter if not ALL
    if (selectedConstellationChip !== 'ALL') {
      return sections.filter(sec => sec.id === selectedConstellationChip);
    }

    return sections;
  }, [filteredSatellites, selectedConstellationChip]);

  const handleExportCSV = () => {
    const headers = "catalog_id,name,intl_desig,object_type,category,altitude_km,inclination,period_min\n";
    const rows = filteredSatellites.map(s => 
      `"${s.catalog_id}","${s.name}","${s.intl_desig || ''}","${s.object_type}","${s.category}",${s.altitude_km},${s.inclination},${s.period_min}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orbit_catalog_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Title & Top Toolbar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-xs uppercase font-mono tracking-wider text-cyan-400 font-semibold block">
              Space Object Registry · Constellation Intelligence
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100 tracking-tight mt-1 font-sans">
            Orbital Catalog &amp; Constellations
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-sans">
            Visually organized by constellations (Starlink, OneWeb, GPS/GNSS, Space Stations) with collapsible telemetry sections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'constellations' && (
            <div className="flex items-center gap-1.5 mr-2">
              <button
                onClick={expandAll}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Expand all constellation sections"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Collapse all constellation sections"
              >
                Collapse All
              </button>
            </div>
          )}

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Constellation Quick-Jump Chips Ribbon */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-mono text-slate-500 uppercase tracking-wider shrink-0 pr-1">
          Constellations:
        </span>
        <button
          onClick={() => setSelectedConstellationChip('ALL')}
          className={`px-3 py-1 rounded-full text-xs font-mono transition-all shrink-0 cursor-pointer border ${
            selectedConstellationChip === 'ALL'
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold shadow-[0_0_12px_rgba(6,182,212,0.25)]'
              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/80'
          }`}
        >
          All ({satellites.length})
        </button>

        {CONSTELLATION_DEFINITIONS.map(c => {
          const matchCount = satellites.filter(c.filterMatch).length;
          const isSelected = selectedConstellationChip === c.id;
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedConstellationChip(isSelected ? 'ALL' : c.id)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition-all shrink-0 cursor-pointer border flex items-center gap-1.5 ${
                isSelected
                  ? `${c.colorScheme.chipBg} border-current font-bold ${c.colorScheme.glow}`
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{c.shortName}</span>
              <span className="opacity-75 tabular-nums text-[11px]">({matchCount})</span>
            </button>
          );
        })}
      </div>

      {/* Control Bar: Search + Segmented Filters + View Toggle */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Starlink, OneWeb, ISS, NORAD ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle: Constellations vs Flat List */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
            <button
              onClick={() => setViewMode('constellations')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'constellations'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Constellations</span>
            </button>
            <button
              onClick={() => setViewMode('flat')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'flat'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>All Objects</span>
            </button>
          </div>

          {/* Regime Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
            {['ALL', 'LEO', 'MEO', 'GEO'].map(reg => (
              <button
                key={reg}
                onClick={() => setSelectedRegime(reg)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  selectedRegime === reg
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {reg}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* VIEW 1: Collapsible Constellation Grouping System */}
      {viewMode === 'constellations' && (
        <div className="space-y-4">
          {constellationSections.filter(sec => sec.count > 0).map(section => {
            const isCollapsed = !!collapsedGroups[section.id];
            const Icon = section.icon;

            return (
              <div
                key={section.id}
                className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                  section.colorScheme.border
                } ${section.colorScheme.bg} shadow-md`}
              >
                {/* Collapsible Constellation Header Card */}
                <div
                  onClick={() => toggleGroup(section.id)}
                  className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/30 transition-colors select-none"
                >
                  <div className="flex items-start md:items-center gap-3">
                    <button
                      className="p-1 rounded-md hover:bg-slate-800 text-slate-400 transition-colors mt-0.5 md:mt-0"
                      aria-label={isCollapsed ? "Expand section" : "Collapse section"}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className={`w-5 h-5 ${section.colorScheme.accent}`} />
                      )}
                    </button>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <div className={`p-1.5 rounded-md ${section.colorScheme.badge}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <h2 className="text-base md:text-lg font-bold text-slate-100 font-sans tracking-tight">
                          {section.name}
                        </h2>
                        <span className="text-xs text-slate-400 font-mono">
                          · {section.operator}
                        </span>
                        <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold ${section.colorScheme.badge}`}>
                          {section.count} {section.count === 1 ? 'Object' : 'Satellites'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1 font-sans">
                        {section.description}
                      </p>
                    </div>
                  </div>

                  {/* Constellation Aggregate Metrics Readout */}
                  <div className="flex items-center gap-5 text-xs font-mono text-slate-400 shrink-0 pl-8 md:pl-0">
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 block">Avg Alt</span>
                      <span className="text-slate-100 font-bold tabular-nums">
                        {section.avgAlt.toFixed(0)} km
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-500 block">Avg Inc</span>
                      <span className="text-slate-100 font-bold tabular-nums">
                        {section.avgInc.toFixed(1)}°
                      </span>
                    </div>
                    <div className="hidden sm:block">
                      <span className="text-[10px] uppercase text-slate-500 block">Fleet Status</span>
                      <span className={`text-[11px] font-semibold ${section.statusColor}`}>
                        ● {section.statusText}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Collapsible Content: Satellite Members Table */}
                {!isCollapsed && (
                  <div className="border-t border-slate-800/80 bg-slate-950/70 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs">
                        <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
                          <tr>
                            <th className="py-2.5 px-4">NORAD ID</th>
                            <th className="py-2.5 px-4">Satellite Name</th>
                            <th className="py-2.5 px-4">Designator</th>
                            <th className="py-2.5 px-4 text-right">Altitude</th>
                            <th className="py-2.5 px-4 text-right">Inclination</th>
                            <th className="py-2.5 px-4 text-right">Period</th>
                            <th className="py-2.5 px-4 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {section.items.map(sat => (
                            <tr key={sat.catalog_id} className="hover:bg-slate-800/40 transition-colors group">
                              <td className="py-3 px-4 font-bold text-cyan-400 tabular-nums">
                                {sat.catalog_id}
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-semibold text-slate-100 font-sans text-sm group-hover:text-cyan-300 transition-colors">
                                  {sat.name}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-400 tabular-nums">
                                {sat.intl_desig || 'NO-DESIG'}
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-slate-200 font-medium">
                                {sat.altitude_km.toFixed(1)} km
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-slate-300">
                                {sat.inclination.toFixed(2)}°
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-slate-300">
                                {sat.period_min.toFixed(1)} min
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => onSelectSatellite(sat)}
                                    title="Track & Lock on 3D Globe"
                                    className="p-1.5 rounded-md hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                                  >
                                    <Orbit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => onViewPasses(sat)}
                                    title="Predict Passes"
                                    className="p-1.5 rounded-md hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => onRunLab(sat)}
                                    title="Analyze in Lab"
                                    className="p-1.5 rounded-md hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                                  >
                                    <Zap className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {constellationSections.every(sec => sec.count === 0) && (
            <div className="py-16 text-center text-slate-500 font-mono text-xs border border-slate-800 rounded-lg bg-slate-900/20">
              No satellites or constellations matched your search criteria "{search}".
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: Standard Flat List View */}
      {viewMode === 'flat' && (
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40 shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[11px] tracking-wider">
                <tr>
                  <th 
                    className="py-3 px-4 cursor-pointer hover:text-slate-200"
                    onClick={() => setSortBy('id')}
                  >
                    <span className="flex items-center gap-1">NORAD ID <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th 
                    className="py-3 px-4 cursor-pointer hover:text-slate-200"
                    onClick={() => setSortBy('name')}
                  >
                    <span className="flex items-center gap-1">Name <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className="py-3 px-4">Category / Constellation</th>
                  <th 
                    className="py-3 px-4 cursor-pointer hover:text-slate-200 text-right"
                    onClick={() => setSortBy('altitude')}
                  >
                    <span className="flex items-center justify-end gap-1">Altitude (km) <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th 
                    className="py-3 px-4 cursor-pointer hover:text-slate-200 text-right"
                    onClick={() => setSortBy('inclination')}
                  >
                    <span className="flex items-center justify-end gap-1">Inclination <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className="py-3 px-4 text-right">Period</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSatellites.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                      No satellites matched your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSatellites.map((sat) => {
                    const isDebris = sat.object_type === 'DEBRIS' || sat.category === 'Debris';
                    return (
                      <tr key={sat.catalog_id} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="py-3 px-4 font-bold text-cyan-400 tabular-nums">
                          {sat.catalog_id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-100 font-sans text-sm group-hover:text-cyan-300 transition-colors">
                            {sat.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {sat.intl_desig || 'NO-DESIG'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            isDebris 
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' 
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {sat.category} · {sat.object_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-slate-200 font-semibold">
                          {sat.altitude_km.toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-slate-300">
                          {sat.inclination.toFixed(2)}°
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-slate-300">
                          {sat.period_min.toFixed(1)} min
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onSelectSatellite(sat)}
                              title="Track on 3D Globe"
                              className="p-1.5 rounded-md hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                            >
                              <Orbit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onViewPasses(sat)}
                              title="Predict Passes"
                              className="p-1.5 rounded-md hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onRunLab(sat)}
                              title="Analyze in Lab"
                              className="p-1.5 rounded-md hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                            >
                              <Zap className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 font-mono pt-2">
        <span>Showing {filteredSatellites.length} of {satellites.length} orbital objects in local catalog</span>
        <span>Local Database: SQLite · Ephemeris Engine: SGP4 / SDP4</span>
      </div>
    </div>
  );
};
