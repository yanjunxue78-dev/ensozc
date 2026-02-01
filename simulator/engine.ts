
import { NX, NY, DX, DY, PARAMS, SimulationState, ClimatologyData } from '../types';
import { getIndex } from './utils';

export class ZCEngine {
  state: SimulationState;
  climatology: ClimatologyData;
  dt: number = 3600; // 1 hour

  rho_w = 1025;
  tau_const = 1.2 * 1.5e-3 * 6.0; 
  r_ekman = 1 / (2 * 24 * 3600); 

  constructor(climatology: ClimatologyData) {
    this.climatology = climatology;
    this.state = this.getInitialState();
  }

  getInitialState(): SimulationState {
    const s: SimulationState = {
      t: new Float32Array(NX * NY).fill(0),
      h: new Float32Array(NX * NY).fill(0),
      u: new Float32Array(NX * NY).fill(0),
      v: new Float32Array(NX * NY).fill(0),
      ua: new Float32Array(NX * NY).fill(0),
      va: new Float32Array(NX * NY).fill(0),
      tauX: new Float32Array(NX * NY).fill(0),
      tauY: new Float32Array(NX * NY).fill(0),
      p: new Float32Array(NX * NY).fill(0),
      month: 0,
      totalSteps: 0,
      isUnstable: false,
    };

    // Initial Condition: Westerly Wind Burst
    for (let j = Math.floor(NY * 0.4); j < Math.floor(NY * 0.6); j++) {
      const y = (j - NY / 2) * DY;
      const latFact = Math.exp(-(y * y) / (2 * 600000 * 600000));
      for (let i = 35; i < 75; i++) {
        const lonFact = Math.sin((i - 35) * Math.PI / 40);
        const burstU = 5.0 * lonFact * latFact;
        const idx = getIndex(i, j, NX);
        s.ua[idx] = burstU;
        s.tauX[idx] = this.tau_const * burstU;
      }
    }
    return s;
  }

  reset() {
    this.state = this.getInitialState();
  }

  step() {
    if (this.state.isUnstable) return;
    this.solveAtmosphere();
    this.solveOceanDynamics();
    this.solveSST();
    this.checkStability();
    this.state.totalSteps++;
    this.state.month = Math.floor((this.state.totalSteps * this.dt) / (30 * 24 * 3600)) % 12;
  }

  private checkStability() {
    for (let i = 0; i < NX * NY; i += 200) {
      if (isNaN(this.state.t[i]) || Math.abs(this.state.t[i]) > 15) {
        this.state.isUnstable = true;
        return;
      }
    }
  }

  private solveAtmosphere() {
    const { epsilon, ca, alpha, beta0 } = PARAMS;
    const { t, ua, va, p, tauX, tauY, totalSteps } = this.state;
    const m = this.state.month;
    const bar_sst = this.climatology.sst[m];

    const Qs = new Float32Array(NX * NY);
    for (let i = 0; i < NX * NY; i++) {
      const T_total = bar_sst[i] + t[i];
      Qs[i] = alpha * t[i] * Math.exp((T_total - 30) / 16.7);
    }

    for (let iter = 0; iter < 10; iter++) {
      const nextP = new Float32Array(p);
      for (let j = 1; j < NY - 1; j++) {
        const y = (j - NY / 2) * DY;
        const f = beta0 * y;
        const f2 = f * f;
        const eps2 = epsilon * epsilon;
        for (let i = 1; i < NX - 1; i++) {
          const idx = getIndex(i, j, NX);
          const px = (p[idx + 1] - p[idx - 1]) / (2 * DX);
          const py = (p[idx + NX] - p[idx - NX]) / (2 * DY);
          ua[idx] = (-epsilon * px - f * py) / (eps2 + f2);
          va[idx] = (-epsilon * py + f * px) / (eps2 + f2);
          const div = (ua[idx + 1] - ua[idx - 1]) / (2 * DX) + (va[idx + NX] - va[idx - NX]) / (2 * DY);
          nextP[idx] = p[idx] - 0.2 * (epsilon * p[idx] + ca * ca * div + Qs[idx]);
        }
      }
      p.set(nextP);
    }

    if (totalSteps < 1080) { 
      const decay = Math.max(0, 1.0 - (totalSteps / 1080));
      for (let j = Math.floor(NY * 0.4); j < Math.floor(NY * 0.6); j++) {
        const y = (j - NY / 2) * DY;
        const latFact = Math.exp(-(y * y) / (2 * 600000 * 600000));
        for (let i = 35; i < 75; i++) {
          const lonFact = Math.sin((i - 35) * Math.PI / 40);
          ua[getIndex(i, j, NX)] += 4.0 * lonFact * latFact * decay;
        }
      }
    }

    for (let i = 0; i < NX * NY; i++) {
      tauX[i] = this.tau_const * ua[i];
      tauY[i] = this.tau_const * va[i];
    }
  }

  private solveOceanDynamics() {
    const { beta0, sqrt_gh, H, rs } = PARAMS;
    const g_prime = (sqrt_gh * sqrt_gh) / H;
    const { u, v, h, tauX, tauY } = this.state;
    const dt = this.dt;

    const nextH = new Float32Array(h);
    const nextU = new Float32Array(u);
    const nextV = new Float32Array(v);

    for (let j = 1; j < NY - 1; j++) {
      for (let i = 1; i < NX - 1; i++) {
        const idx = getIndex(i, j, NX);
        if (this.climatology.bath[idx] === 0) continue;

        const hx = (h[idx + 1] - h[idx - 1]) / (2 * DX);
        const hy = (h[idx + NX] - h[idx - NX]) / (2 * DY);

        const uStar = u[idx] + dt * (-g_prime * hx + tauX[idx] / (this.rho_w * H));
        const vStar = v[idx] + dt * (-g_prime * hy + tauY[idx] / (this.rho_w * H));

        const y = (j - NY / 2) * DY;
        const f = beta0 * y;
        const A = 1 + rs * dt;
        const B = f * dt;
        const det = A * A + B * B;

        nextU[idx] = (A * uStar + B * vStar) / det;
        nextV[idx] = (A * vStar - B * uStar) / det;
      }
    }

    for (let j = 1; j < NY - 1; j++) {
      for (let i = 1; i < NX - 1; i++) {
        const idx = getIndex(i, j, NX);
        if (this.climatology.bath[idx] === 0) {
            nextH[idx] = 0;
            continue;
        }
        const div = (nextU[idx + 1] - nextU[idx - 1]) / (2 * DX) + (nextV[idx + NX] - nextV[idx - NX]) / (2 * DY);
        nextH[idx] = (h[idx] - dt * H * div) / (1 + rs * dt);
      }
    }

    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const idx = getIndex(i, j, NX);
        if (i === 0 || i === NX - 1 || this.climatology.bath[idx] === 0) {
          nextU[idx] = 0; nextV[idx] = 0; nextH[idx] = 0;
        }
        if (j === 0) {
            nextU[idx] = nextU[idx + NX]; nextV[idx] = nextV[idx + NX]; nextH[idx] = nextH[idx + NX];
        } else if (j === NY - 1) {
            nextU[idx] = nextU[idx - NX]; nextV[idx] = nextV[idx - NX]; nextH[idx] = nextH[idx - NX];
        }
      }
    }
    u.set(nextU); v.set(nextV); h.set(nextH);
  }

  private solveSST() {
    const { alphas, H1, H2, H, gamma_sst, T1, T2, b1, b2, beta0 } = PARAMS;
    const { t, u, v, h, tauX, tauY } = this.state;
    const m = this.state.month;
    const bar_u = this.climatology.u[m];
    const bar_v = this.climatology.v[m];
    const bar_sst = this.climatology.sst[m];
    const dt = this.dt;

    const nextT = new Float32Array(t);
    const u1 = new Float32Array(NX * NY);
    const v1 = new Float32Array(NX * NY);

    for (let j = 0; j < NY; j++) {
      const y = (j - NY / 2) * DY;
      const f = beta0 * y;
      const det = this.r_ekman * this.r_ekman + f * f;
      for (let i = 0; i < NX; i++) {
        const idx = getIndex(i, j, NX);
        const us = (this.r_ekman * tauX[idx] / (this.rho_w * H1) + f * tauY[idx] / (this.rho_w * H1)) / det;
        const vs = (this.r_ekman * tauY[idx] / (this.rho_w * H1) - f * tauX[idx] / (this.rho_w * H1)) / det;
        u1[idx] = u[idx] + (H2 / H) * us;
        v1[idx] = v[idx] + (H2 / H) * vs;
      }
    }

    for (let j = 1; j < NY - 1; j++) {
      for (let i = 1; i < NX - 1; i++) {
        const idx = getIndex(i, j, NX);
        if (this.climatology.bath[idx] === 0) {
            nextT[idx] = 0; continue;
        }

        let Tsub = h[idx] >= 0 
          ? T1 * (Math.tanh(b1 * (H1 + h[idx])) - Math.tanh(b1 * H1))
          : T2 * (Math.tanh(b2 * (H1 - h[idx])) - Math.tanh(b2 * H1));
        const Te = gamma_sst * Tsub + (1 - gamma_sst) * t[idx];

        const div1 = (u1[idx+1] - u1[idx-1]) / (2*DX) + (v1[idx+NX] - v1[idx-NX]) / (2*DY);
        const bar_div = (bar_u[idx+1] - bar_u[idx-1]) / (2*DX) + (bar_v[idx+NX] - bar_v[idx-NX]) / (2*DY);
        const upwelling = -Math.max(0, H1 * (bar_div + div1)) * (t[idx] - Te) / H1;

        const utot = u1[idx] + bar_u[idx];
        const vtot = v1[idx] + bar_v[idx];
        
        const dTx = utot > 0 ? (t[idx] - t[idx - 1]) / DX : (t[idx + 1] - t[idx]) / DX;
        const dTy = vtot > 0 ? (t[idx] - t[idx - NX]) / DY : (t[idx + NX] - t[idx]) / DY;

        const bar_dTx = (bar_sst[idx+1] - bar_sst[idx-1]) / (2*DX);
        const bar_dTy = (bar_sst[idx+NX] - bar_sst[idx-NX]) / (2*DY);

        const advection = -(utot * dTx + vtot * dTy + u1[idx] * bar_dTx + v1[idx] * bar_dTy);
        nextT[idx] = t[idx] + dt * (advection + upwelling - alphas * t[idx]);
      }
    }

    for (let j = 0; j < NY; j++) {
        for (let i = 0; i < NX; i++) {
            const idx = getIndex(i, j, NX);
            if (i === 0 || i === NX - 1 || this.climatology.bath[idx] === 0) nextT[idx] = 0;
            if (j === 0) nextT[idx] = nextT[idx + NX];
            if (j === NY - 1) nextT[idx] = nextT[idx - NX];
        }
    }
    t.set(nextT);
  }
}
