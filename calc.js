// DrRobert – logika obliczeń (bez interfejsu). Wzory: geometria + podstawy mechaniki.
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

// Odsunięcie dwoma kolanami w jednej płaszczyźnie (offset H, kąt, promień kolana R)
function offset({ H, angle, R, od }) {
  const t = rad(angle);
  const travel = H / Math.sin(t);          // od środka do środka kolan
  const run = H / Math.tan(t);             // przesunięcie wzdłuż osi
  const take = R * Math.tan(t / 2);        // odliczenie na kolano
  return { travel, run, take, cut: travel - 2 * take, total: run + 2 * take };
}
// Odsunięcie przestrzenne (rolling offset): wzniesienie + rozstaw
function rolling({ rise, spread, angle }) {
  const T = Math.hypot(rise, spread);
  const t = rad(angle);
  return { trueOffset: T, travel: T / Math.sin(t), run: T / Math.tan(t),
           rollAngle: deg(Math.atan2(rise, spread)) };
}
// Kolano segmentowe z prostych odcinków (n cięć, kąt całkowity, promień R, średnica D)
function mitre({ angle, cuts, R, D }) {
  const n = cuts;                          // liczba cięć (łączeń)
  const sawAngle = angle / (2 * n);        // kąt piły na każdym cięciu
  const end = R * Math.tan(rad(angle / (2 * n)));  // dł. połowy końcowego odcinka (oś)
  const mid = 2 * end;                     // środkowe segmenty
  return { sawAngle, endSeg: end, midSeg: mid, waveHeight: D * Math.tan(rad(sawAngle)) };
}
// Rozwinięcie odgałęzienia 90° (fishmouth): rura odgałęzienia d wchodzi w główną D
function fishmouth({ d, D, points = 16 }) {
  const r = d / 2, Rm = D / 2;
  if (d > D + 1e-9) throw new Error('Odgałęzienie nie może być grubsze niż rura główna');
  const rows = [];
  for (let i = 0; i <= points; i++) {
    const phi = (2 * Math.PI * i) / points;
    const h = Rm - Math.sqrt(Rm * Rm - Math.pow(r * Math.sin(phi), 2));
    rows.push({ i, arc: (Math.PI * d * i) / points, h });
  }
  return { circumference: Math.PI * d, rows };
}
// Spadek – przeliczanie między jednostkami
function slope({ type, value }) {
  let rise; // m/m
  if (type === 'percent') rise = value / 100;
  else if (type === 'mmm') rise = value / 1000;
  else if (type === 'ratio') rise = 1 / value;
  else if (type === 'deg') rise = Math.tan(rad(value));
  else throw new Error('Nieznany typ');
  return { percent: rise * 100, mmPerM: rise * 1000, ratio: 1 / rise, deg: deg(Math.atan(rise)) };
}
// Rozwinięcie stożka ściętego: D duża, d mała, wysokość h
function cone({ D, d, h }) {
  const slantBig = Math.hypot(h, (D - d) / 2);
  const apexSlant = d >= D ? Infinity : (D * slantBig) / (D - d);  // do wierzchołka
  const Rbig = apexSlant, Rsmall = apexSlant - slantBig;
  const sector = (Math.PI * D) / Rbig;                              // rad
  const vol = (Math.PI * h / 12) * (D * D + D * d + d * d);
  return { slant: slantBig, Rbig, Rsmall, sectorDeg: deg(sector),
           chord: 2 * Rbig * Math.sin(sector / 2), volumeL: vol / 1e6 };
}
// Masa i objętość odcinka rury
function pipeMass({ od, wall, length, rho = 7850 }) {
  const id = od - 2 * wall;
  if (id <= 0) throw new Error('Ścianka za gruba względem średnicy');
  const steelM3 = Math.PI / 4 * (od * od - id * id) / 1e6 * (length / 1000);
  const insideL = Math.PI / 4 * id * id / 1e6 * (length / 1000) * 1000;
  return { id, steelKg: steelM3 * rho, kgPerM: steelM3 * rho / (length / 1000), waterL: insideL };
}
// Dylatacja cieplna (domyślnie stal węglowa 12e-6 1/K)
function expansion({ length, dT, alpha = 12e-6 }) { return { dL: length * alpha * dT }; }

// Cale ↔ mm. Parser: 4' 7 5/16"  |  7 5/16  |  5/8  |  3.25
function parseInches(s) {
  s = String(s).trim().replace(/[”“″]/g, '"').replace(/[’‘′]/g, "'");
  let total = 0, m;
  m = s.match(/^(-?\d+(?:\.\d+)?)\s*'/);
  if (m) { total += parseFloat(m[1]) * 12; s = s.slice(m[0].length).trim(); }
  s = s.replace(/"$/, '').trim();
  if (s) {
    const parts = s.split(/\s+/); let sum = 0;
    for (const p of parts) {
      if (/^\d+\/\d+$/.test(p)) { const [a, b] = p.split('/').map(Number); if (!b) return NaN; sum += a / b; }
      else if (/^\d+(\.\d+)?$/.test(p)) sum += parseFloat(p);
      else return NaN;
    }
    total += sum;
  }
  return total * 25.4;
}
function toFeetInches(mm) {
  let inches = mm / 25.4, sign = inches < 0 ? '-' : ''; inches = Math.abs(inches);
  let ft = Math.floor(inches / 12), rest = inches - ft * 12;
  let whole = Math.floor(rest), frac = Math.round((rest - whole) * 16);
  if (frac === 16) { whole++; frac = 0; }
  if (whole === 12) { ft++; whole = 0; }
  let f = ''; if (frac) { let n = frac, d = 16; while (n % 2 === 0) { n /= 2; d /= 2; } f = ` ${n}/${d}`; }
  return `${sign}${ft ? ft + "' " : ''}${whole}${f}"`;
}
if (typeof module !== 'undefined') module.exports = { offset, rolling, mitre, fishmouth, slope, cone, pipeMass, expansion, parseInches, toFeetInches };
