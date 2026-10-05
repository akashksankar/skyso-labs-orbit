import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, X, Minimize2, Maximize2, Send, CornerDownLeft } from 'lucide-react';

interface TerminalConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  events: { timestamp: string; type: string; message: string; isCommand?: boolean }[];
  onExecuteCommand: (command: string) => Promise<string>;
}

export const TerminalConsole: React.FC<TerminalConsoleProps> = ({
  isOpen,
  onClose,
  events,
  onExecuteCommand
}) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [executing, setExecuting] = useState<boolean>(false);
  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;

    setHistory(prev => [...prev, cmd]);
    setHistoryIdx(-1);
    setInput('');
    setExecuting(true);

    await onExecuteCommand(cmd);
    setExecuting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
        setHistoryIdx(nextIdx);
        setInput(history[nextIdx] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx !== -1) {
        const nextIdx = historyIdx + 1;
        if (nextIdx >= history.length) {
          setHistoryIdx(-1);
          setInput('');
        } else {
          setHistoryIdx(nextIdx);
          setInput(history[nextIdx] || '');
        }
      }
    }
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-30 bg-[#06080e]/98 border-t border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col transition-all duration-300 ${
        isExpanded ? 'h-96' : 'h-64'
      }`}
    >
      {/* Top Header */}
      <div className="h-8 px-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-mono font-bold text-slate-300">
            ORBIT TERMINAL &amp; REAL-TIME EVENT STREAM
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-slate-800 hover:text-slate-200 transition-colors"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 hover:text-slate-200 transition-colors"
            title="Close Terminal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Output Console Log */}
      <div className="flex-1 p-3 overflow-y-auto font-mono text-xs space-y-1 text-slate-300">
        <div className="text-slate-500 text-[11px] pb-1 border-b border-slate-900">
          SKYso Labs ORBIT CLI Bridge active. Type <span className="text-cyan-400">help</span> or execute commands: <span className="text-slate-300">track ISS</span>, <span className="text-slate-300">pass ISS</span>, <span className="text-slate-300">groundtrack ISS</span>, <span className="text-slate-300">doctor</span>.
        </div>

        {events.map((ev, idx) => {
          let badgeColor = 'text-cyan-400';
          if (ev.type === 'EVENT' || ev.type === 'OBJECT_SELECTED') badgeColor = 'text-emerald-400';
          else if (ev.type === 'ERROR') badgeColor = 'text-rose-400';
          else if (ev.type === 'COMMAND') badgeColor = 'text-amber-400 font-bold';

          return (
            <div key={idx} className="flex items-start gap-2 leading-relaxed">
              <span className="text-slate-600 text-[10px] tabular-nums select-none shrink-0 pt-0.5">
                {ev.timestamp}
              </span>
              <span className={`text-[10px] font-bold uppercase shrink-0 ${badgeColor}`}>
                [{ev.type}]
              </span>
              <span className="whitespace-pre-wrap flex-1 text-slate-300">
                {ev.message}
              </span>
            </div>
          );
        })}
        {executing && (
          <div className="flex items-center gap-2 text-cyan-400 text-xs">
            <span className="animate-spin text-[10px]">&#9696;</span>
            <span>Running command...</span>
          </div>
        )}
        <div ref={outputEndRef} />
      </div>

      {/* Interactive Command Input Line */}
      <form onSubmit={handleSubmit} className="p-2 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2">
        <div className="text-cyan-400 font-mono text-xs font-bold pl-2 select-none">
          orbit&gt;
        </div>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type 'track ISS', 'doctor', 'groundtrack 25544', 'catalog'..."
          disabled={executing}
          className="flex-1 bg-transparent border-0 text-slate-100 font-mono text-xs focus:outline-none placeholder-slate-600"
          autoFocus
        />
        <button
          type="submit"
          disabled={executing || !input.trim()}
          className="p-1.5 rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 disabled:opacity-40 transition-colors"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
