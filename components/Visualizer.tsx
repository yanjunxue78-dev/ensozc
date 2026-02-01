
import React, { useEffect, useRef } from 'react';
import { NX, NY } from '../types';

interface VisualizerProps {
  data: Float32Array;
  label: string;
  min: number;
  max: number;
  mode?: 'contour' | 'vector';
  bath?: Int8Array;
  vectors?: { u: Float32Array; v: Float32Array };
}

const Visualizer: React.FC<VisualizerProps> = ({ data, label, min, max, mode = 'contour', bath, vectors }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const RESOLUTION_SCALE = 4; // High-res multiplier

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Set internal resolution
    canvas.width = NX * RESOLUTION_SCALE;
    canvas.height = NY * RESOLUTION_SCALE;
    ctx.scale(RESOLUTION_SCALE, RESOLUTION_SCALE);

    // 1. Draw Background (Ocean)
    ctx.fillStyle = '#0a101f'; // Deeper ocean blue for contrast
    ctx.fillRect(0, 0, NX, NY);

    // 2. Draw Data Layer (Contour)
    if (mode === 'contour') {
      const imageData = ctx.createImageData(NX, NY);
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < NX; i++) {
          const idx = j * NX + i;
          // Skip land
          if (bath && bath[idx] === 0) continue;

          const val = data[idx];
          const norm = Math.max(0, Math.min(1, (val - min) / (max - min)));
          
          // N-S Flip for imageData indexing
          const targetIdx = ((NY - 1 - j) * NX + i) * 4;

          // Thermal / Jet-like colormap
          const r = Math.max(0, Math.min(255, Math.floor(255 * (1.5 - Math.abs(norm * 4 - 3)))));
          const g = Math.max(0, Math.min(255, Math.floor(255 * (1.5 - Math.abs(norm * 4 - 2)))));
          const b = Math.max(0, Math.min(255, Math.floor(255 * (1.5 - Math.abs(norm * 4 - 1)))));
          
          imageData.data[targetIdx] = r;
          imageData.data[targetIdx + 1] = g;
          imageData.data[targetIdx + 2] = b;
          imageData.data[targetIdx + 3] = 255;
        }
      }
      const offscreen = document.createElement('canvas');
      offscreen.width = NX;
      offscreen.height = NY;
      offscreen.getContext('2d')?.putImageData(imageData, 0, 0);
      ctx.drawImage(offscreen, 0, 0);
    }

    // 3. Draw Land (Bathymetry) - Must be drawn after contour but before vectors if we want land to overlay contour
    if (bath) {
      ctx.fillStyle = '#2d2d30'; // Land grey
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < NX; i++) {
          const idx = j * NX + i;
          if (bath[idx] === 0) {
            // Flip N-S
            ctx.fillRect(i, NY - 1 - j, 1, 1);
          }
        }
      }
    }

    // 4. Draw Vectors
    if (vectors) {
      ctx.strokeStyle = mode === 'vector' ? '#60a5fa' : 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 0.8 / RESOLUTION_SCALE;
      const step = 6; 
      
      // Calculate a local max magnitude for adaptive scaling if needed, 
      // but here we just use a larger fixed scale s based on typical ocean/wind ranges.
      // Wind is ~10m/s, Ocean is ~1m/s.
      const isOcean = label.toLowerCase().includes("ocean") || label.toLowerCase().includes("current");
      const s = isOcean ? 8.0 : 1.5; // Ocean current arrows need more magnification

      for (let j = 0; j < NY; j += step) {
        for (let i = 0; i < NX; i += step) {
          const idx = j * NX + i;
          // Skip if land (no wind/current vectors on land for this visual style)
          if (bath && bath[idx] === 0) continue;

          const u = vectors.u[idx];
          const v = vectors.v[idx];
          const mag = Math.sqrt(u * u + v * v);
          if (mag < 0.01) continue;

          // Flip N-S coordinates for the canvas
          const startX = i;
          const startY = NY - 1 - j;
          const endX = i + u * s;
          const endY = (NY - 1 - j) - v * s; 

          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          
          // Arrowhead logic
          const headlen = 1.4;
          const angle = Math.atan2(-v, u);
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(endX, endY);
          ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
        }
      }
    }
  }, [data, min, max, mode, bath, vectors, label]);

  return (
    <div className="flex flex-col items-center bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-2xl w-full">
      <h3 className="text-sm font-black mb-3 text-slate-300 uppercase tracking-widest">{label}</h3>
      <div className="relative border border-slate-700 w-full overflow-hidden rounded bg-black shadow-inner">
        <canvas 
          ref={canvasRef} 
          className="w-full h-auto block"
          style={{ aspectRatio: `${NX}/${NY}` }}
        />
        <div className="absolute bottom-1 right-1 flex space-x-2 text-[10px] text-white/50 bg-black/70 px-2 py-0.5 rounded backdrop-blur-sm">
          <span>Min: {min.toFixed(2)}</span>
          <span>Max: {max.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default Visualizer;
