
import React, { useEffect, useRef } from 'react';
import { NX } from '../types';

interface LineChartProps {
  data: Float32Array;
  label: string;
  min: number; // e.g. -300
  max: number; // e.g. 0
  baseline?: number; // e.g. -150
}

const LineChart: React.FC<LineChartProps> = ({ data, label, min, max, baseline = -150 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = 2;
    canvas.width = canvas.offsetWidth * scale;
    canvas.height = 200 * scale;
    const width = canvas.width;
    const height = canvas.height;
    ctx.scale(scale, scale);
    
    const drawWidth = canvas.width / scale;
    const drawHeight = canvas.height / scale;

    ctx.clearRect(0, 0, drawWidth, drawHeight);
    
    // Background
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, drawWidth, drawHeight);

    // Surface line (0m)
    const surfaceY = drawHeight - ((0 - min) / (max - min)) * drawHeight;
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, surfaceY);
    ctx.lineTo(drawWidth, surfaceY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Grid (every 50m)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    for (let d = min; d <= max; d += 50) {
      const y = drawHeight - ((d - min) / (max - min)) * drawHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(drawWidth, y);
      ctx.stroke();
    }

    // Baseline (-150m)
    const baselineY = drawHeight - ((baseline - min) / (max - min)) * drawHeight;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(drawWidth, baselineY);
    ctx.stroke();

    // Plot: z = -150 - h_x
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
      const val = baseline - data[i]; // Logic: z = -150 - h_x
      const x = (i / (data.length - 1)) * drawWidth;
      const y = drawHeight - ((val - min) / (max - min)) * drawHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(`Surface (0m)`, 5, surfaceY - 5);
    ctx.fillText(`${max}m`, drawWidth - 30, 12);
    ctx.fillText(`${min}m`, drawWidth - 30, drawHeight - 5);
    ctx.fillText(`Thermocline Profile (z = ${baseline} - h_x)`, 5, 15);
  }, [data, min, max, baseline]);

  return (
    <div className="flex flex-col items-center bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-2xl w-full">
      <h3 className="text-sm font-black mb-3 text-slate-300 uppercase tracking-widest">{label}</h3>
      <div className="relative border border-slate-700 w-full bg-black/40 rounded overflow-hidden shadow-inner">
        <canvas 
          ref={canvasRef} 
          className="w-full h-[200px]"
        />
      </div>
    </div>
  );
};

export default LineChart;
