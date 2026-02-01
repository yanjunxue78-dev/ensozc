
export const superbee = (r: number): number => {
  return Math.max(0, Math.min(2 * r, 1), Math.min(r, 2));
};

export const getIndex = (x: number, y: number, nx: number) => y * nx + x;

export const parseDatFile = (text: string, nx: number, ny: number, is1D: boolean = false): Float32Array[] | Float32Array => {
  const values = text.trim().split(/\s+/).map(Number);
  if (is1D) {
    return new Float32Array(values);
  }
  
  const months: Float32Array[] = [];
  const pointsPerMonth = nx * ny;
  for (let m = 0; m < 12; m++) {
    const start = m * pointsPerMonth;
    if (start >= values.length) break;
    months.push(new Float32Array(values.slice(start, start + pointsPerMonth)));
  }
  return months;
};

export const generateMockClimatology = (nx: number, ny: number) => {
  const createField = (valFunc: (x: number, y: number, m: number) => number) => {
    const months = [];
    for (let m = 0; m < 12; m++) {
      const data = new Float32Array(nx * ny);
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          data[j * nx + i] = valFunc(i, j, m);
        }
      }
      months.push(data);
    }
    return months;
  };

  return {
    ua: createField((i, j, m) => -5 + 2 * Math.cos(m * Math.PI / 6)),
    va: createField((i, j, m) => Math.sin(j * 0.1)),
    tauX: createField((i, j, m) => -0.05 * Math.cos(j * 0.05)),
    tauY: createField(() => 0),
    u: createField(() => 0),
    v: createField(() => 0),
    hx: new Float32Array(nx).map((_, i) => -80 + (i - nx/2) * 0.2),
    sst: createField((i, j, m) => 26 + 3 * Math.cos((i - nx / 2) * 0.02) - Math.abs(j - ny / 2) * 0.3),
    bath: new Int8Array(nx * ny).fill(1).map((v, i) => {
        const x = i % nx;
        const y = Math.floor(i / nx);
        if (x < 10 && (y < 20 || y > 50)) return 0;
        if (x > 168) return 0;
        return 1;
    })
  };
};
