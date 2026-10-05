import React from 'react';
import { Activity, Terminal as TerminalIcon, Stethoscope, Radio } from 'lucide-react';

interface HeaderProps {
  currentTab: 'globe' | 'catalog' | 'passes' | 'analytics' | 'lab';
  setCurrentTab: (tab: 'globe' | 'catalog' | 'passes' | 'analytics' | 'lab') => void;
  terminalOpen: boolean;
  setTerminalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenDoctor: () => void;
  wsConnected: boolean;
  trackedSatName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  terminalOpen,
  setTerminalOpen,
  onOpenDoctor,
  wsConnected,
  trackedSatName
}) => {
  return (
    <header className="h-14 bg-[#07090e]/95 border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between z-30 select-none backdrop-blur-md sticky top-0">
      {/* Zone 1: Single Wordmark Brand */}
      <div className="flex items-center gap-3">
        <a
          href="#globe"
          onClick={(e) => { e.preventDefault(); setCurrentTab('globe'); }}
          className="text-lg font-bold tracking-widest text-slate-100 hover:text-cyan-400 transition-colors uppercase font-mono flex items-center gap-2"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#06b6d4]"></span>
          ORBIT
        </a>
        <span className="text-xs text-slate-500 font-mono hidden sm:inline">by Skyso Labs</span>
      </div>

      {/* Zone 2: Navigation Links (single-line, text with clean active indicator) */}
      <nav className="flex items-center gap-1 sm:gap-6 text-xs md:text-sm font-medium text-slate-400">
        <button
          onClick={() => setCurrentTab('globe')}
          className={`px-2 py-1 transition-colors whitespace-nowrap ${
            currentTab === 'globe'
              ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400'
              : 'hover:text-slate-200'
          }`}
        >
          3D Globe
        </button>
        <button
          onClick={() => setCurrentTab('catalog')}
          className={`px-2 py-1 transition-colors whitespace-nowrap ${
            currentTab === 'catalog'
              ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400'
              : 'hover:text-slate-200'
          }`}
        >
          Catalog
        </button>
        <button
          onClick={() => setCurrentTab('passes')}
          className={`px-2 py-1 transition-colors whitespace-nowrap ${
            currentTab === 'passes'
              ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400'
              : 'hover:text-slate-200'
          }`}
        >
          Passes
        </button>
        <button
          onClick={() => setCurrentTab('analytics')}
          className={`px-2 py-1 transition-colors whitespace-nowrap ${
            currentTab === 'analytics'
              ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400'
              : 'hover:text-slate-200'
          }`}
        >
          Analytics
        </button>
        <button
          onClick={() => setCurrentTab('lab')}
          className={`px-2 py-1 transition-colors whitespace-nowrap ${
            currentTab === 'lab'
              ? 'text-cyan-400 font-semibold border-b-2 border-cyan-400'
              : 'hover:text-slate-200'
          }`}
        >
          Research Lab
        </button>
      </nav>

      {/* Zone 3: Primary Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Status chip with explicit text and symbol */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono">
          <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-amber-400'}`}></span>
          <span className="text-slate-300">{wsConnected ? 'LIVE WS' : 'OFFLINE'}</span>
          {trackedSatName && (
            <>
              <span className="text-slate-600">/</span>
              <span className="text-cyan-400 font-medium truncate max-w-[100px]">{trackedSatName}</span>
            </>
          )}
        </div>

        <button
          onClick={onOpenDoctor}
          title="System Diagnostics & Health"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:text-slate-100 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded transition-colors whitespace-nowrap cursor-pointer"
        >
          <Stethoscope className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Doctor</span>
        </button>

        <button
          onClick={() => setTerminalOpen(!terminalOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded border transition-colors whitespace-nowrap cursor-pointer ${
            terminalOpen
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
              : 'bg-slate-900/80 text-slate-300 hover:text-slate-100 border-slate-800 hover:bg-slate-800'
          }`}
          title="Toggle Terminal & Event Console"
        >
          <TerminalIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Terminal</span>
        </button>
      </div>
    </header>
  );
};
