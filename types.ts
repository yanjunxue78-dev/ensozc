
export const NX = 178;
export const NY = 67;
export const DX = 100000; // 100km in meters
export const DY = 100000; // 100km in meters
export const MONTHS = 12;

export interface SimulationState {
  t: Float32Array; // SST perturbation
  h: Float32Array; // Thermocline depth perturbation
  u: Float32Array; // Ocean velocity u
  v: Float32Array; // Ocean velocity v
  ua: Float32Array; // Atmos wind u
  va: Float32Array; // Atmos wind v
  tauX: Float32Array; // Wind stress anomaly X
  tauY: Float32Array; // Wind stress anomaly Y
  p: Float32Array; // Atmos pressure
  month: number;
  totalSteps: number;
  isUnstable: boolean;
}

export interface ClimatologyData {
  ua: Float32Array[];
  va: Float32Array[];
  tauX: Float32Array[];
  tauY: Float32Array[];
  u: Float32Array[];
  v: Float32Array[];
  hx: Float32Array; 
  sst: Float32Array[];
  bath: Int8Array;
}

export const PARAMS = {
  epsilon: 1 / (2 * 24 * 3600), // Atmos damping
  ca: 60, // Atmos phase speed
  alpha: 0.031, // Coupling coeff
  beta: 1.6e-4,
  gamma_ocn: 1 / (2.5 * 365 * 24 * 3600),
  sqrt_gh: 2.9, // Ocean phase speed m/s
  H: 150, // Depth of thermocline
  H1: 50, // Depth of mixed layer
  H2: 100,
  rs: 1 / (400 * 24 * 3600), // Ocean damping
  alphas: 1 / (125 * 24 * 3600), // SST damping
  gamma_sst: 0.75,
  T1: 28,
  T2: -40,
  b1: 1 / 80,
  b2: 1 / 33,
  beta0: 2.28e-11, 
  rho0: 1.2, 
  rho_w: 1025,
};
