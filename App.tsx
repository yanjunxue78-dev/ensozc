
import React, { useState, useEffect } from 'react';
import { ZCEngine } from './simulator/engine';
import { generateMockClimatology, parseDatFile } from './simulator/utils';
import { NX, NY, ClimatologyData, SimulationState } from './types';
import Visualizer from './components/Visualizer';
import LineChart from './components/LineChart';

const App: React.FC = () => {
  const [climatology, setClimatology] = useState<ClimatologyData | null>(null);
  const [engine, setEngine] = useState<ZCEngine | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<'climatology' | 'simulation'>('climatology');
  const [climMonth, setClimMonth] = useState(0);
  const [simState, setSimState] = useState<SimulationState | null>(null);

  useEffect(() => {
    const mock = generateMockClimatology(NX, NY);
    setClimatology(mock);
    const eng = new ZCEngine(mock);
    setEngine(eng);
    setSimState({ ...eng.state });
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file || !climatology) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const is1D = type === 'hx' || type === 'bath';
      const parsed = parseDatFile(text, NX, NY, is1D);
      
      const newClim = { ...climatology };
      if (type === 'bath') {
        (newClim as any).bath = new Int8Array(parsed as Float32Array);
      } else {
        (newClim as any)[type] = parsed;
      }
      setClimatology(newClim);
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (engine) {
      engine.reset();
      setSimState({ ...engine.state });
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isPlaying && engine && viewMode === 'simulation' && !simState?.isUnstable) {
      interval = setInterval(() => {
        for (let i = 0; i < 12; i++) {
          engine.step();
          if (engine.state.isUnstable) break;
        }
        setSimState({ ...engine.state });
      }, 40);
    } else if (isPlaying && viewMode === 'climatology') {
      interval = setInterval(() => {
        setClimMonth(prev => (prev + 1) % 12);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, engine, viewMode, simState?.isUnstable]);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 bg-slate-950 text-slate-100">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-slate-800 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-white tracking-tighter">ENSO <span className="text-blue-500">Z-C</span> MODEL</h1>
          <p className="text-slate-500 text-xs font-mono uppercase tracking-[0.2em]">Coupled Atmosphere-Ocean Simulation</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800">
            <button onClick={() => { setViewMode('climatology'); setIsPlaying(false); }} className={`px-5 py-2 rounded-lg text-sm font-black transition-all ${viewMode === 'climatology' ? 'bg-blue-600' : 'text-slate-500'}`}>CLIMATOLOGY</button>
            <button onClick={() => { setViewMode('simulation'); }} className={`px-5 py-2 rounded-lg text-sm font-black transition-all ${viewMode === 'simulation' ? 'bg-blue-600' : 'text-slate-500'}`}>SIMULATION</button>
          </div>
          <div className="flex gap-2">
            {viewMode === 'simulation' && <button onClick={handleReset} className="px-4 py-2.5 rounded-xl font-black text-xs bg-slate-800 border border-slate-700">RESET</button>}
            <button onClick={() => setIsPlaying(!isPlaying)} className={`px-10 py-2.5 rounded-xl font-black transition-all ${isPlaying ? 'bg-rose-600' : 'bg-emerald-600'}`} disabled={simState?.isUnstable}>{isPlaying ? 'PAUSE' : 'START'}</button>
          </div>
        </div>
      </header>

      {simState?.isUnstable && (
        <div className="mb-6 p-4 bg-rose-500/20 border border-rose-500 rounded-xl flex items-center justify-between text-rose-200">
          <div><p className="font-black">Stability Failure</p><p className="text-xs">Model became unstable. Reset to continue.</p></div>
          <button onClick={handleReset} className="px-4 py-2 bg-rose-600 rounded-lg text-xs font-black">RESET</button>
        </div>
      )}

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden">
        <aside className="lg:col-span-3 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Control</h2>
            <div className="font-mono text-xs space-y-2">
              <div className="flex justify-between"><span>Step:</span> <span>{simState?.totalSteps}</span></div>
              <div className="flex justify-between"><span>Month:</span> <span>{monthNames[simState?.month || 0]}</span></div>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="text-xs font-black text-slate-500 uppercase mb-4">Files</h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {[
                {k:'tauX', l:'Tau X'}, {k:'tauY', l:'Tau Y'}, 
                {k:'ua', l:'Atmos U'}, {k:'va', l:'Atmos V'},
                {k:'u', l:'Ocean U'}, {k:'v', l:'Ocean V'},
                {k:'hx', l:'Profile'}, {k:'sst', l:'SST'}, {k:'bath', l:'Bathymetry'}
              ].map(f => (
                <div key={f.k} className="p-2 bg-slate-950 border border-slate-800 rounded">
                  <span className="text-[10px] font-black block mb-1 uppercase text-slate-400">{f.l}</span>
                  <input type="file" onChange={(e) => handleFileUpload(e, f.k)} className="block w-full text-[9px]" />
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="lg:col-span-9 h-full overflow-y-auto pr-2 custom-scrollbar pb-10">
          {viewMode === 'climatology' && climatology ? (
            <div className="flex flex-col gap-8">
              <Visualizer data={climatology.sst[climMonth]} label={`Clim SST - ${monthNames[climMonth]}`} min={18} max={30} bath={climatology.bath} />
              <Visualizer data={climatology.ua[climMonth]} label="Clim Wind" min={-10} max={10} mode="vector" bath={climatology.bath} vectors={{ u: climatology.ua[climMonth], v: climatology.va[climMonth] }} />
              <LineChart data={climatology.hx} label="Clim Thermocline Profile" min={-300} max={0} />
            </div>
          ) : viewMode === 'simulation' && simState ? (
            <div className="flex flex-col gap-8">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <Visualizer data={simState.t} label="SST Anomaly" min={-3} max={3} bath={climatology?.bath} />
                <Visualizer data={simState.h} label="Thermocline Anomaly" min={-60} max={60} bath={climatology?.bath} />
              </div>
              <Visualizer data={new Float32Array(simState.t.length).map((v, i) => (climatology?.sst[simState.month][i] || 0) + simState.t[i])} label="Total SST" min={18} max={32} bath={climatology?.bath} />
              <LineChart data={simState.h} label="Simulated Profile" min={-300} max={0} />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default App;
