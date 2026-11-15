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
// ---------- SPAWANIE ----------
const STEEL_G_CM3 = 7.85; // gęstość stopiwa stalowego, g/cm³
// Spoina pachwinowa: a (grubość miarodajna) ↔ z (bok). Trójkąt równoramienny prostokątny: z = a·√2.
function fillet({ a, z, pitch, len, jointLength }) {
  if (a == null && z == null) throw new Error('Podaj a albo z');
  const A_ = a != null ? a : z / Math.SQRT2, Z_ = z != null ? z : a * Math.SQRT2;
  const area = A_ * A_;                                   // mm² (= z²/2)
  const out = { a: A_, z: Z_, area, gramsPerM: area * STEEL_G_CM3 }; // 1 m spoiny = area cm³
  if (pitch && len && jointLength) {
    if (len > pitch) throw new Error('Długość odcinka nie może być większa od podziałki');
    const n = Math.floor((jointLength - len) / pitch) + 1;  // pierwszy odcinek od początku
    out.count = Math.max(n, 0); out.totalWeld = out.count * len; out.fraction = len / pitch;
    out.grams = (out.totalWeld / 1000) * out.gramsPerM;
  }
  return out;
}
// Rowek V (jednostronny): grubość t, kąt rowka (całkowity), nadsadzka c, szczelina g
function vPrep({ t, angle, root, gap }) {
  const h = t - root;
  if (h <= 0) throw new Error('Nadsadzka musi być mniejsza od grubości');
  const tg = Math.tan(rad(angle / 2));
  const width = gap + 2 * h * tg;
  const area = gap * h + h * h * tg;                      // mm²
  return { width, area, gramsPerM: area * STEEL_G_CM3, depth: h };
}
// Wkład ciepła wg EN 1011-1: Q = k·U·I/(1000·v)  [kJ/mm], v w mm/s.
const THERMAL_K = { '111': 0.8, '121': 1.0, '131': 0.8, '135': 0.8, '136': 0.8, '138': 0.8, '141': 0.6, '15': 0.6 };
function heatInput({ U, I, speed, length, time, process = '135' }) {
  const v = speed != null ? speed : length / time;        // mm/s
  if (!(v > 0)) throw new Error('Prędkość spawania musi być > 0');
  const k = THERMAL_K[process];
  if (k == null) throw new Error('Nieznany proces');
  return { k, speed: v, arcEnergy: U * I / (1000 * v), Q: k * U * I / (1000 * v) };
}
// Podgrzewanie wstępne – EN 1011-2, metoda B (CET). Wzór orientacyjny: zawsze sprawdź w WPS/normie.
function cet({ C, Mn, Cr = 0, Mo = 0, Cu = 0, Ni = 0 }) { return C + (Mn + Mo) / 10 + (Cr + Cu) / 20 + Ni / 40; }
function preheat({ C, Mn, Cr, Mo, Cu, Ni, d, HD, Q }) {
  const CET = cet({ C, Mn, Cr, Mo, Cu, Ni });
  const Tp = 697 * CET + 160 * Math.tanh(d / 35) + 62 * Math.pow(HD, 0.35) + (53 * CET - 32) * Q - 328;
  return { CET, Tp, needed: Tp > 20 };
}
// Przedmuch (forming gas / argon): objętość wnętrza, czas, zużycie, prędkość przepływu w rurze
function purge({ id, length, flow, changes = 5, pricePerM3 = 0 }) {
  const aMm2 = Math.PI / 4 * id * id;
  const volL = aMm2 * length / 1e6;                       // litry
  const liters = volL * changes;
  return { volL, timeMin: liters / flow, liters, cost: liters / 1000 * pricePerM3,
           velocity: (flow * 1e6 / 60) / aMm2 / 1000 };   // m/s
}
// Dennica: kształt z wymiarów wewn. Di, grubość s, prosty kołnierz h1. Powierzchnia po warstwie środkowej.
function head({ type, Di, s, h1 }) {
  const Dm = Di + s, Da = Di + 2 * s;
  let area, dome, Rc = null, rk = null;
  if (type === 'ellipse') {                               // ASME 2:1 (a:b = 2:1), b = Dm/4 po warstwie środkowej
    const a = Dm / 2, b = a / 2, e = Math.sqrt(1 - b * b / (a * a));
    area = Math.PI * a * a + Math.PI * b * b / (2 * e) * Math.log((1 + e) / (1 - e));
    dome = Di / 4;
  } else {
    const k = type === 'klopper' ? [1.0, 0.1] : [0.8, 0.154];   // DIN 28011 / DIN 28013 – po średnicy zewnętrznej
    Rc = k[0] * Da; rk = k[1] * Da;
    const Rm = Rc - s / 2, rm = rk - s / 2, xk = Dm / 2 - rm;
    const q = (Rm - rm) ** 2 - xk * xk;
    if (q <= 0) throw new Error('Nieprawidłowa geometria dennicy');
    const phi = Math.asin(xk / (Rm - rm));
    const cap = 2 * Math.PI * Rm * Rm * (1 - Math.cos(phi));
    const tor = 2 * Math.PI * rm * (xk * (Math.PI / 2 - phi) + rm * Math.cos(phi));
    area = cap + tor;
    dome =(Rm - Math.sqrt(q)) - s / 2;              // wewnętrzna wysokość wypukłości
  }
  area += Math.PI * Dm * h1;
  return { blank: Math.sqrt(4 * area / Math.PI), dome, crownR: Rc, knuckleR: rk, totalHeight: dome + h1, blankArea: area };
}
// Skurcz: suma = liczba spoin × skurcz z jednej; kalibracja z pomiaru
function shrinkage({ welds, perWeld, measuredTotal, measuredWelds }) {
  const per = measuredTotal != null ? measuredTotal / measuredWelds : perWeld;
  return { perWeld: per, total: welds * per };
}
// ---------- IZOMETRIA ----------
// Średnice: DN, zewn. średnica (mm), NPS (cale). Kolana 90° wg ASME B16.9: LR = 1,5·NPS, SR = 1·NPS (środek–koniec).
const DN_TABLE = [
  { dn: 25, od: 33.7, nps: 1 }, { dn: 32, od: 42.4, nps: 1.25 }, { dn: 40, od: 48.3, nps: 1.5 },
  { dn: 50, od: 60.3, nps: 2 }, { dn: 65, od: 76.1, nps: 2.5 }, { dn: 80, od: 88.9, nps: 3 },
  { dn: 100, od: 114.3, nps: 4 }, { dn: 125, od: 139.7, nps: 5 }, { dn: 150, od: 168.3, nps: 6 },
  { dn: 200, od: 219.1, nps: 8 }, { dn: 250, od: 273, nps: 10 }, { dn: 300, od: 323.9, nps: 12 }];
function elbowA(dn, series) {
  const r = DN_TABLE.find(x => x.dn === dn);
  if (!r) throw new Error('Nieznane DN');
  return r.nps * 25.4 * (series === 'SR' ? 1 : 1.5);
}
const ISO_DIR = { E: [1, 0, 0], W: [-1, 0, 0], N: [0, 1, 0], S: [0, -1, 0], U: [0, 0, 1], D: [0, 0, -1] };
// segs: [{dir:'E', len:1000}, ...] – długości po osiach (środek–środek). Sąsiednie odcinki w tym samym kierunku łączymy.
function isoAnalyze({ segs, dn = 100, series = 'LR', start = [0, 0, 0] }) {
  const A = elbowA(dn, series);
  const m = [];
  for (const s of segs) {
    if (!ISO_DIR[s.dir] || !(s.len > 0)) throw new Error('Zły odcinek');
    if (m.length && m[m.length - 1].dir === s.dir) m[m.length - 1].len += s.len; else m.push({ dir: s.dir, len: s.len });
  }
  for (let i = 1; i < m.length; i++) {
    const a = ISO_DIR[m[i - 1].dir], b = ISO_DIR[m[i].dir];
    if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] === -1) throw new Error('Zawrócenie o 180° jest niemożliwe – dodaj kolano pośrednie');
  }
  const pts = [start.slice()]; let p = start.slice();
  for (const s of m) { const d = ISO_DIR[s.dir]; p = [p[0] + d[0] * s.len, p[1] + d[1] * s.len, p[2] + d[2] * s.len]; pts.push(p); }
  const cuts = m.map((s, i) => {
    const t0 = i > 0 ? A : 0, t1 = i < m.length - 1 ? A : 0;
    return { dir: s.dir, center: s.len, cut: s.len - t0 - t1, takeStart: t0, takeEnd: t1 };
  });
  const elbows = Math.max(m.length - 1, 0);
  const welds = [];
  for (let k = 1; k <= elbows; k++) { welds.push({ elbow: k, side: 'wlot' }); welds.push({ elbow: k, side: 'wylot' }); }
  return { segs: m, points: pts, cuts, elbows, elbowA: A, welds, pipeTotal: cuts.reduce((a, c) => a + Math.max(c.cut, 0), 0),
           tooShort: cuts.some(c => c.cut <= 0) };
}
// ---------- DXF R12 (LINE) ----------
function dxfBuild(lines, layers) {
  const L = [];
  const add = (c, v) => { L.push(String(c)); L.push(String(v)); };
  add(0, 'SECTION'); add(2, 'TABLES');
  add(0, 'TABLE'); add(2, 'LTYPE'); add(70, 1); add(0, 'LTYPE'); add(2, 'CONTINUOUS'); add(70, 0); add(3, 'Solid line'); add(72, 65); add(73, 0); add(40, 0.0); add(0, 'ENDTAB');
  add(0, 'TABLE'); add(2, 'LAYER'); add(70, layers.length);
  layers.forEach(l => { add(0, 'LAYER'); add(2, l.name); add(70, 0); add(62, l.color); add(6, 'CONTINUOUS'); });
  add(0, 'ENDTAB'); add(0, 'ENDSEC');
  add(0, 'SECTION'); add(2, 'ENTITIES');
  for (const e of lines) { add(0, 'LINE'); add(8, e.layer); add(10, e.x1.toFixed(4)); add(20, e.y1.toFixed(4)); add(30, 0); add(11, e.x2.toFixed(4)); add(21, e.y2.toFixed(4)); add(31, 0); }
  add(0, 'ENDSEC'); add(0, 'EOF');
  return L.join('\r\n') + '\r\n';
}
function fishmouthDxf({ d, D, points = 16 }) {
  const f = fishmouth({ d, D, points }), mx = Math.max(...f.rows.map(r => r.h)), C = f.circumference, top = mx + 20, lines = [];
  for (let i = 0; i < f.rows.length - 1; i++) lines.push({ layer: 'CIECIE', x1: f.rows[i].arc, y1: f.rows[i].h, x2: f.rows[i + 1].arc, y2: f.rows[i + 1].h });
  lines.push({ layer: 'OBRYS', x1: 0, y1: 0, x2: 0, y2: top }, { layer: 'OBRYS', x1: C, y1: 0, x2: C, y2: top }, { layer: 'OBRYS', x1: 0, y1: top, x2: C, y2: top });
  return dxfBuild(lines, [{ name: 'CIECIE', color: 1 }, { name: 'OBRYS', color: 7 }]);
}
function coneDxf({ D, d, h, seg = 90 }) {
  const c = cone({ D, d, h }), a = c.sectorDeg * Math.PI / 180, lines = [];
  const arc = (R, layer) => { for (let i = 0; i < seg; i++) { const t0 = -a / 2 + a * i / seg, t1 = -a / 2 + a * (i + 1) / seg;
    lines.push({ layer, x1: R * Math.sin(t0), y1: -R * Math.cos(t0), x2: R * Math.sin(t1), y2: -R * Math.cos(t1) }); } };
  arc(c.Rbig, 'CIECIE'); if (c.Rsmall > 0) arc(c.Rsmall, 'CIECIE');
  for (const t of [-a / 2, a / 2]) lines.push({ layer: 'CIECIE', x1: c.Rsmall * Math.sin(t), y1: -c.Rsmall * Math.cos(t), x2: c.Rbig * Math.sin(t), y2: -c.Rbig * Math.cos(t) });
  return dxfBuild(lines, [{ name: 'CIECIE', color: 1 }]);
}
if (typeof module !== 'undefined') module.exports = { offset, rolling, mitre, fishmouth, slope, cone, pipeMass, expansion, parseInches, toFeetInches, fillet, vPrep, heatInput, cet, preheat, purge, head, shrinkage, THERMAL_K, DN_TABLE, elbowA, isoAnalyze, dxfBuild, fishmouthDxf, coneDxf };
