import React, { useState, useEffect, useRef } from 'react';
import { Satellite, ObserverConfig } from './types/orbit';
import { Header } from './components/Header';
import { Globe3D } from './components/Globe3D';
import { TelemetryDrawer } from './components/TelemetryDrawer';
import { CatalogView } from './components/CatalogView';
import { PassesView } from './components/PassesView';
import { AnalyticsView } from './components/AnalyticsView';
import { ResearchLabView } from './components/ResearchLabView';
import { TerminalConsole } from './components/TerminalConsole';
import { DoctorModal } from './components/DoctorModal';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'globe' | 'catalog' | 'passes' | 'analytics' | 'lab'>('globe');
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [selectedSat, setSelectedSat] = useState<Satellite | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [terminalOpen, setTerminalOpen] = useState<boolean>(false);
  const [doctorOpen, setDoctorOpen] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const [observer, setObserver] = useState<ObserverConfig>({
    name: "Cape Canaveral Ground Station",
    latitude: 28.5721,
    longitude: -80.6480,
    altitude_m: 10.0,
    min_elevation_deg: 10.0
  });

  const [terminalEvents, setTerminalEvents] = useState<
    { timestamp: string; type: string; message: string; isCommand?: boolean }[]
  >([
    {
      timestamp: new Date().toLocaleTimeString(),
      type: 'INIT',
      message: 'SKYso Labs ORBIT Engine v1.0.0 initializing in local-first environment...'
    }
  ]);

  const wsRef = useRef<WebSocket | null>(null);

  // Fetch initial catalog
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await fetch('/api/catalog');
        if (res.ok) {
          const data = await res.json();
          setSatellites(data.satellites || []);
          if (data.satellites && data.satellites.length > 0 && !selectedSat) {
            const iss = data.satellites.find((s: Satellite) => s.catalog_id === '25544') || data.satellites[0];
            setSelectedSat(iss);
          }
        }
      } catch {}
    };
    fetchCatalog();
  }, []);

  // WebSocket Connection & Bidirectional Sync
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      logTerminalEvent('WEBSOCKET', 'Bi-directional WebSocket bridge established (/ws)');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type, payload } = data;

        if (type === 'SERVER_READY') {
          logTerminalEvent('SERVER_READY', `Local engine ready. SGP4 propagation initialized.`);
          if (payload?.observer) {
            setObserver(payload.observer);
          }
        } else if (type === 'OBJECT_SELECTED' || type === 'TRACK_STARTED') {
          const satId = payload.catalog_id;
          const match = satellites.find(s => s.catalog_id === satId);
          if (match) {
            setSelectedSat(match);
            setDrawerOpen(true);
            logTerminalEvent('TRACK', `Target locked: ${match.name} (NORAD ${match.catalog_id})`);
          }
        } else if (type === 'GROUNDTRACK_REQUESTED') {
          const satId = payload.catalog_id;
          const match = satellites.find(s => s.catalog_id === satId);
          if (match) {
            setSelectedSat(match);
            setCurrentTab('globe');
            setDrawerOpen(true);
            logTerminalEvent('GROUNDTRACK', `Ground track computed for ${match.name}`);
          }
        } else if (type === 'OBSERVER_UPDATED') {
          setObserver(payload);
          logTerminalEvent('OBSERVER', `Ground station updated: ${payload.name} (${payload.latitude}°, ${payload.longitude}°)`);
        }
      } catch {}
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [satellites]);

  const logTerminalEvent = (type: string, message: string, isCommand: boolean = false) => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalEvents(prev => [...prev.slice(-100), { timestamp, type, message, isCommand }]);
  };

  const handleSelectSatellite = (sat: Satellite) => {
    setSelectedSat(sat);
    setDrawerOpen(true);
    logTerminalEvent('SELECT', `Selected object: ${sat.name} (${sat.catalog_id})`);

    // Broadcast selection via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'OBJECT_SELECTED',
        payload: { catalog_id: sat.catalog_id, name: sat.name }
      }));
    }
  };

  const handleExecuteCommand = async (command: string): Promise<string> => {
    logTerminalEvent('COMMAND', `orbit> ${command}`, true);

    const trimmed = command.trim();
    if (trimmed === 'clear') {
      setTerminalEvents([]);
      return 'Terminal cleared.';
    }

    try {
      const res = await fetch('/api/cli/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: trimmed })
      });
      const data = await res.json();
      const output = data.output || 'Execution finished.';
      logTerminalEvent('CLI', output);
      return output;
    } catch (err: any) {
      const errMsg = `Error: ${err.message}`;
      logTerminalEvent('ERROR', errMsg);
      return errMsg;
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col relative font-sans">
      {/* Top Bar Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        terminalOpen={terminalOpen}
        setTerminalOpen={setTerminalOpen}
        onOpenDoctor={() => setDoctorOpen(true)}
        wsConnected={wsConnected}
        trackedSatName={selectedSat?.name}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col">
        {currentTab === 'globe' && (
          <div className="relative flex-1 w-full h-[calc(100vh-3.5rem)]">
            <Globe3D
              satellites={satellites}
              selectedSat={selectedSat}
              onSelectSatellite={handleSelectSatellite}
              observer={observer}
            />

            {/* Floating Satellite Details HUD Drawer */}
            {drawerOpen && selectedSat && (
              <TelemetryDrawer
                satellite={selectedSat}
                onClose={() => setDrawerOpen(false)}
                onViewGroundtrack={() => {
                  logTerminalEvent('GROUNDTRACK', `Ground track computed for ${selectedSat.name}`);
                }}
                onViewPasses={(s) => {
                  setSelectedSat(s);
                  setCurrentTab('passes');
                }}
                onRunLab={(s) => {
                  setSelectedSat(s);
                  setCurrentTab('lab');
                }}
              />
            )}
          </div>
        )}

        {currentTab === 'catalog' && (
          <CatalogView
            satellites={satellites}
            onSelectSatellite={(sat) => {
              handleSelectSatellite(sat);
              setCurrentTab('globe');
            }}
            onViewPasses={(sat) => {
              setSelectedSat(sat);
              setCurrentTab('passes');
            }}
            onRunLab={(sat) => {
              setSelectedSat(sat);
              setCurrentTab('lab');
            }}
          />
        )}

        {currentTab === 'passes' && (
          <PassesView
            satellites={satellites}
            selectedSat={selectedSat}
            onSelectSatellite={setSelectedSat}
            observer={observer}
            onUpdateObserver={setObserver}
          />
        )}

        {currentTab === 'analytics' && (
          <AnalyticsView
            satellites={satellites}
            onSelectSatellite={(sat) => {
              handleSelectSatellite(sat);
              setCurrentTab('globe');
            }}
          />
        )}

        {currentTab === 'lab' && (
          <ResearchLabView
            satellites={satellites}
            selectedSat={selectedSat}
          />
        )}
      </main>

      {/* Integrated Terminal & Event Stream */}
      <TerminalConsole
        isOpen={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        events={terminalEvents}
        onExecuteCommand={handleExecuteCommand}
      />

      {/* Doctor Health Diagnostics Modal */}
      <DoctorModal
        isOpen={doctorOpen}
        onClose={() => setDoctorOpen(false)}
        wsConnected={wsConnected}
      />
    </div>
  );
};

export default App;
