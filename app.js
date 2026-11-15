'use strict';
/* DrRobert – interfejs. Własny kod; logika w calc.js. */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const load = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
let unit = load('dr_unit') === 'in' ? 'in' : 'mm';

// ---------- formatowanie ----------
const fmt = mm => (isNaN(mm) || !isFinite(mm)) ? '—' : unit === 'in' ? toFeetInches(mm) : (Math.round(mm * 10) / 10).toFixed(1) + ' mm';
const fmtIn = mm => unit === 'in' ? toFeetInches(mm) : String(Math.round(mm * 100) / 100);
const parseLen = s => unit === 'in' ? parseInches(s) : parseFloat(String(s).replace(',', '.'));
const parseNum = s => parseFloat(String(s).replace(',', '.'));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2200); }
function download(name, text, type) {
  const a = document.createElement('a'), b = new Blob([text], { type: type || 'text/plain' });
  a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ---------- rysowanie SVG ----------
const COL = { g: '#7ed957', r: '#ff5b5b', o: '#f5a623', b: '#5ab4ff' };
const DEFS = '<defs>' + Object.entries(COL).map(([k, c]) => `<marker id="a${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`).join('') +
  '<pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#1a2a3a" stroke-width="1"/></pattern></defs>';
const svgWrap = (w, h, inner) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${DEFS}<rect width="${w}" height="${h}" fill="url(#grid)"/>${inner}</svg>`;
const lbl = (x, y, t, c) => { const w = t.length * 7.2 + 12; return `<rect x="${(x - w / 2).toFixed(1)}" y="${(y - 10).toFixed(1)}" width="${w.toFixed(1)}" height="18" rx="4" fill="#0b1118" opacity=".9"/><text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" text-anchor="middle" fill="${c}" font-size="12" font-family="ui-monospace,Consolas,monospace" font-weight="700">${esc(t)}</text>`; };
const dimLine = (x1, y1, x2, y2, k, t, dx = 0, dy = 0) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${COL[k]}" stroke-width="1.6" marker-start="url(#a${k})" marker-end="url(#a${k})"/>` + lbl((x1 + x2) / 2 + dx, (y1 + y2) / 2 + dy, t, COL[k]);

function drawOffset(v, r) {
  const th = v.A * Math.PI / 180, c = Math.cos(th), s = Math.sin(th), lead = Math.max(r.run * 0.35, v.OD * 2.2);
  const V1 = [lead, 0], V2 = [lead + r.travel * c, r.travel * s], W = V2[0] + lead;
  const W_ = 760, H_ = 340, k = Math.min((W_ - 80) / W, (H_ - 130) / (v.H + v.OD)), ox = 30, oy = H_ - 60 - v.OD * k / 2;
  const P = p => [ox + p[0] * k, oy - p[1] * k], f = p => P(p).map(x => x.toFixed(1)).join(' ');
  const t = r.take, T1a = [V1[0] - t, 0], T1b = [V1[0] + t * c, t * s], T2a = [V2[0] - t * c, V2[1] - t * s], T2b = [V2[0] + t, V2[1]];
  const Rp = (v.R * k).toFixed(1);
  const d = v.R > 0 ? `M${f([0, 0])}L${f(T1a)}A${Rp} ${Rp} 0 0 0 ${f(T1b)}L${f(T2a)}A${Rp} ${Rp} 0 0 1 ${f(T2b)}L${f([W, V2[1]])}` : `M${f([0, 0])}L${f(V1)}L${f(V2)}L${f([W, V2[1]])}`;
  const odp = v.OD * k, rho = Math.max(34, odp * 0.8), [x1, y1] = P(V1), [x2, y2] = P(V2);
  const wedge = (x, y, a0, a1) => `<path d="M${x.toFixed(1)} ${y.toFixed(1)}L${(x + rho * Math.cos(a0)).toFixed(1)} ${(y - rho * Math.sin(a0)).toFixed(1)}A${rho} ${rho} 0 0 ${a1 > a0 ? 0 : 1} ${(x + rho * Math.cos(a1)).toFixed(1)} ${(y - rho * Math.sin(a1)).toFixed(1)}Z" fill="${COL.o}" opacity=".35" stroke="${COL.o}"/>`;
  let g = `<path d="${d}" fill="none" stroke="#9db4cc" stroke-width="${(odp + 5).toFixed(1)}"/><path d="${d}" fill="none" stroke="#2b3f55" stroke-width="${odp.toFixed(1)}"/><path d="${d}" fill="none" stroke="${COL.g}" stroke-width="1.4" stroke-dasharray="7 4"/>`;
  g += wedge(x1, y1, 0, th) + wedge(x2, y2, 0, th);
  g += lbl(x1 + rho * 0.9, y1 - rho * 0.35 - 14, v.A + '°', COL.o);
  const xr = P(T2b)[0] + 26;
  g += dimLine(xr, P([0, 0])[1], xr, P([0, v.H])[1], 'r', fmt(v.H), -34, 0);
  const yb = P([0, 0])[1] + odp / 2 + 30;
  g += dimLine(P(T1a)[0], yb, P(T2b)[0], yb, 'g', fmt(r.total), 0, 0);
  g += `<line x1="${P(T1a)[0].toFixed(1)}" y1="${yb - 6}" x2="${P(T1a)[0].toFixed(1)}" y2="${(P([0, 0])[1] + 4).toFixed(1)}" stroke="${COL.g}" opacity=".5"/><line x1="${P(T2b)[0].toFixed(1)}" y1="${yb - 6}" x2="${P(T2b)[0].toFixed(1)}" y2="${(P([0, 0])[1] + 4).toFixed(1)}" stroke="${COL.g}" opacity=".5"/>`;
  g += dimLine(P(T1a)[0], yb + 22, x1, yb + 22, 'o', fmt(r.take), 0, 0);
  g += dimLine(ox + 6, P([0, 0])[1] - odp / 2, ox + 6, P([0, 0])[1] + odp / 2, 'b', '⌀' + fmt(v.OD), 36, 0);
  const ax = P([V1[0] + 0.1 * r.travel * c, 0.1 * r.travel * s]);
  g += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${COL.g}" stroke-width="1" opacity=".0"/>`;
  return svgWrap(W_, H_, g);
}
function drawMitre(v, r) {
  const n = v.n, dl = v.A / n * Math.PI / 180, e = r.endSeg, lead = e * 1.6;
  const lens = [lead, e]; for (let i = 1; i < n; i++) lens.push(r.midSeg); lens.push(e); lens.push(lead);
  const P2 = [[0, 0]]; let ang = 0, x = 0, y = 0; const J = [];
  for (let i = 0; i < lens.length; i++) { x += lens[i] * Math.cos(ang); y += lens[i] * Math.sin(ang); P2.push([x, y]); if (i >= 1 && i <= n) { ang += dl; J.push({ p: [x, y], a: ang - dl / 2 }); } }
  const xs = P2.map(p => p[0]), ys = P2.map(p => p[1]), minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const W_ = 760, H_ = 340, k = Math.min((W_ - 100) / (maxx - minx || 1), (H_ - 100) / ((maxy - miny) + v.D || 1)), ox = 50 - minx * k, oy = H_ - 50 + miny * k - 0;
  const S = p => [(ox + p[0] * k).toFixed(1), (oy - p[1] * k).toFixed(1)];
  const d = P2.map((p, i) => (i ? 'L' : 'M') + S(p).join(' ')).join('');
  const odp = v.D * k;
  let g = `<path d="${d}" fill="none" stroke="#9db4cc" stroke-width="${(odp + 5).toFixed(1)}" stroke-linejoin="miter" stroke-miterlimit="12"/><path d="${d}" fill="none" stroke="#2b3f55" stroke-width="${odp.toFixed(1)}" stroke-linejoin="miter" stroke-miterlimit="12"/><path d="${d}" fill="none" stroke="${COL.g}" stroke-width="1.4" stroke-dasharray="7 4"/>`;
  J.forEach(j => { const [cx, cy] = S(j.p), nx = -Math.sin(j.a), ny = Math.cos(j.a), hl = odp * 0.62 / Math.cos(dl / 2); g += `<line x1="${(+cx - nx * hl).toFixed(1)}" y1="${(+cy + ny * hl).toFixed(1)}" x2="${(+cx + nx * hl).toFixed(1)}" y2="${(+cy - ny * hl).toFixed(1)}" stroke="${COL.o}" stroke-width="2"/>`; });
  g += lbl(W_ / 2, 28, `${n} cięć · piła ${r.sawAngle.toFixed(2)}° · ${v.A}°`, COL.o);
  return svgWrap(W_, H_, g);
}
function drawFish(f, d) {
  const W = 700, H = 200, mx = Math.max(...f.rows.map(r => r.h)) || 1, kx = W / f.circumference, ky = Math.min(110 / mx, 3);
  const pts = f.rows.map(r => `${(30 + r.arc * kx).toFixed(1)},${(30 + (mx - r.h) * ky).toFixed(1)}`).join(' ');
  let g = `<rect x="30" y="${(30 - 0).toFixed(1)}" width="${W}" height="${(mx * ky + 25).toFixed(1)}" fill="none" stroke="#9db4cc" stroke-dasharray="4 4"/><polyline points="${pts}" fill="none" stroke="${COL.g}" stroke-width="2.5"/>`;
  f.rows.forEach(r => { g += `<circle cx="${(30 + r.arc * kx).toFixed(1)}" cy="${(30 + (mx - r.h) * ky).toFixed(1)}" r="3" fill="${COL.o}"/>`; });
  g += dimLine(30, mx * ky + 62, 30 + W, mx * ky + 62, 'g', 'obwód ' + fmt(f.circumference));
  return svgWrap(760, Math.ceil(mx * ky + 85), g);
}
function drawCone(r, v) {
  const a = r.sectorDeg * Math.PI / 180, W = 760, H = 330, k = Math.min(250 / r.Rbig, 560 / (2 * r.Rbig * Math.sin(Math.min(a / 2, Math.PI / 2)) || 1)), cx = W / 2, cy = 30;
  const P = (R, t) => [(cx + R * k * Math.sin(t)).toFixed(1), (cy + R * k * Math.cos(t)).toFixed(1)];
  const big = a > Math.PI ? 1 : 0, Rb = (r.Rbig * k).toFixed(1), Rs = (r.Rsmall * k).toFixed(1);
  let g = `<path d="M${P(r.Rbig, -a / 2)}A${Rb} ${Rb} 0 ${big} 0 ${P(r.Rbig, a / 2)}L${P(r.Rsmall, a / 2)}A${Rs} ${Rs} 0 ${big} 1 ${P(r.Rsmall, -a / 2)}Z" fill="rgba(126,217,87,.08)" stroke="${COL.g}" stroke-width="2.5"/>`;
  g += `<circle cx="${cx}" cy="${cy}" r="4" fill="${COL.o}"/>` + lbl(cx, cy + 22, r.sectorDeg.toFixed(1) + '°', COL.o);
  g += lbl(cx + (r.Rbig * k * 0.55) * Math.sin(a / 2 + 0.0) * 0.5, cy + r.Rbig * k * 0.5, 'R ' + fmt(r.Rbig), COL.g);
  return svgWrap(W, H, g);
}

// ---------- definicje narzędzi ----------
const LEN = (id, label, def, min, max, step) => ({ id, label, t: 'len', def, min, max, step });
const NUM = (id, label, def, min, max, step) => ({ id, label, t: 'num', def, min, max, step });
const SEL = (id, label, def, opts, show) => ({ id, label, t: 'sel', def, opts, show });
const ANG = (id, label, def, chips, min, max, step) => ({ id, label, t: 'ang', def, chips, min, max, step });
const card = (l, v) => [l, v];
const bad = m => ({ error: m });

const TOOLS = [
  { id: 'odsun', cat: 'Kolana i przesunięcia', name: 'Odsunięcie dwoma kolanami', desc: 'Dwa kolana w jednej płaszczyźnie, rysunek w skali.',
    fields: [LEN('H', 'Odsunięcie (oś do osi)', 260, 20, 1500, 5), ANG('A', 'Kąt kolana', 45, [11.25, 22.5, 30, 45, 60], 1, 89, 0.25), LEN('R', 'Promień kolana R', 70, 0, 400, 1), LEN('OD', 'Średnica zewnętrzna rury', 53, 10, 500, 0.5)],
    calc(v) { if (!(v.H > 0 && v.A > 0 && v.A < 90 && v.R >= 0 && v.OD > 0)) return bad('Podaj poprawne dane (kąt 1–89°).');
      const r = offset({ H: v.H, angle: v.A, R: v.R }); const c = [card('Rura do wycięcia', fmt(r.cut)), card('Odliczenie na kolano', fmt(r.take)), card('Długość całkowita', fmt(r.total)), card('Od środka do środka', fmt(r.travel))];
      return { cards: c, svg: drawOffset(v, r), error: r.cut <= 0 ? 'Za krótko: kolana się stykają.' : null, note: 'Wstawkę mierzy się od czoła do czoła kształtek, bez szczeliny spawalniczej.', warn: 'Sprawdź wymiar na stali przed cięciem.' }; } },
  { id: 'prostop', cat: 'Kolana i przesunięcia', name: 'Odsunięcie przestrzenne', desc: 'Wzniesienie + rozstaw (rolling offset).',
    fields: [LEN('S', 'Rozstaw (w bok)', 400, 0, 2000, 5), LEN('V', 'Wzniesienie (w górę)', 300, 0, 2000, 5), ANG('A', 'Kąt kolana', 45, [22.5, 30, 45, 60], 1, 89, 0.25)],
    calc(v) { if (!(v.S >= 0 && v.V >= 0 && v.A > 0 && v.A < 90 && v.S + v.V > 0)) return bad('Podaj poprawne dane.');
      const r = rolling({ rise: v.V, spread: v.S, angle: v.A }); return { cards: [card('Odsunięcie rzeczywiste', fmt(r.trueOffset)), card('Środek–środek', fmt(r.travel)), card('Przesunięcie wzdłuż osi', fmt(r.run)), card('Obrót płaszczyzny', r.rollAngle.toFixed(1) + '°')], note: 'Odliczenie na kolana: odejmij R·tan(kąt/2) z każdej strony.' }; } },
  { id: 'mitre', cat: 'Kolana i przesunięcia', name: 'Kolano segmentowe', desc: 'Kolano z prostych odcinków: kąt piły i długości.',
    fields: [ANG('A', 'Kąt kolana', 90, [30, 45, 60, 90], 10, 180, 1), SEL('n', 'Liczba cięć', 3, [[2, '2'], [3, '3'], [4, '4'], [5, '5']]), LEN('R', 'Promień osi kolana R', 150, 20, 800, 5), LEN('D', 'Średnica zewnętrzna', 60, 10, 500, 0.5)],
    calc(v) { if (!(v.A > 0 && v.A <= 180 && v.R > 0 && v.D > 0)) return bad('Podaj poprawne dane.');
      const r = mitre({ angle: v.A, cuts: +v.n, R: v.R, D: v.D }); return { cards: [card('Kąt piły (cięcie)', r.sawAngle.toFixed(2) + '°'), card('Segment końcowy (oś)', fmt(r.endSeg)), card('Segment środkowy (oś)', fmt(r.midSeg)), card('Wysokość fali', fmt(r.waveHeight))], svg: drawMitre({ ...v, n: +v.n }, r), note: 'Długości po osi rury. Wysokość fali do znakowania obwodu to D·tg(kąt piły).' }; } },
  { id: 'stozek', cat: 'Blachy i rozwinięcia', name: 'Stożek / redukcja', desc: 'Rozwinięcie stożka ściętego, eksport DXF 1:1.',
    fields: [LEN('D', 'Średnica duża', 200, 20, 1500, 5), LEN('d', 'Średnica mała', 100, 0, 1500, 5), LEN('h', 'Wysokość', 100, 10, 1500, 5)],
    calc(v) { if (!(v.D > v.d && v.d >= 0 && v.h > 0)) return bad('Średnica duża musi być większa od małej.');
      const r = cone({ D: v.D, d: v.d, h: v.h }); return { cards: [card('Promień zewn. łuku', fmt(r.Rbig)), card('Promień wewn. łuku', fmt(r.Rsmall)), card('Kąt wycinka', r.sectorDeg.toFixed(1) + '°'), card('Cięciwa', fmt(r.chord)), card('Pochyła', fmt(r.slant)), card('Objętość', r.volumeL.toFixed(2) + ' l')], svg: drawCone(r, v), dxf: { name: 'stozek.dxf', text: coneDxf({ D: v.D, d: v.d, h: v.h }) }, note: 'DXF w skali 1:1 (mm), warstwa CIECIE. Dodaj naddatek na zakładkę.' }; } },
  { id: 'odgal', cat: 'Odgałęzienia', name: 'Odgałęzienie 90°', desc: 'Szablon do owinięcia rury, DXF 1:1.',
    fields: [LEN('d', 'Średnica odgałęzienia', 60.3, 10, 600, 0.5), LEN('D', 'Średnica rury głównej', 114.3, 10, 1000, 0.5), SEL('p', 'Punktów na obwodzie', 16, [[8, '8'], [16, '16'], [24, '24']])],
    calc(v) { if (!(v.d > 0 && v.D > 0)) return bad('Podaj średnice.'); try { const f = fishmouth({ d: v.d, D: v.D, points: +v.p }); const mx = Math.max(...f.rows.map(r => r.h));
      return { cards: [card('Obwód', fmt(f.circumference)), card('Głębokość cięcia', fmt(mx))], svg: drawFish(f), dxf: { name: 'odgalezienie.dxf', text: fishmouthDxf({ d: v.d, D: v.D, points: +v.p }) },
        table: { head: ['Nr', 'Wzdłuż obwodu', 'Od krawędzi'], rows: f.rows.map(r => [r.i, fmt(r.arc), fmt(r.h)]) }, note: 'Odmierz „od krawędzi” w każdym punkcie, połącz płynną linią i tnij po niej.' }; } catch (e) { return bad(e.message); } } },
  { id: 'spadek', cat: 'Przepływ i obciążenia', name: 'Spadek', desc: 'Przeliczanie %, mm/m, 1:n i stopni.',
    fields: [SEL('t', 'Wpisz w jednostkach', 'percent', [['percent', '%'], ['mmm', 'mm/m'], ['ratio', '1 : n'], ['deg', 'stopnie']]), NUM('x', 'Wartość', 2, 0.1, 100, 0.1)],
    calc(v) { if (!(v.x > 0)) return bad('Podaj wartość większą od 0.'); const r = slope({ type: v.t, value: v.x }); return { cards: [card('Procent', r.percent.toFixed(3) + ' %'), card('mm na metr', r.mmPerM.toFixed(2)), card('1 : n', '1 : ' + r.ratio.toFixed(1)), card('Stopnie', r.deg.toFixed(3) + '°')] }; } },
  { id: 'masa', cat: 'Przepływ i obciążenia', name: 'Masa i pojemność rury', desc: 'Masa stali, woda w środku.',
    fields: [LEN('od', 'Średnica zewnętrzna', 60.3, 10, 1000, 0.5), LEN('w', 'Grubość ścianki', 3.6, 0.5, 50, 0.1), LEN('l', 'Długość', 6000, 100, 20000, 50)],
    calc(v) { if (!(v.od > 0 && v.w > 0 && v.l > 0)) return bad('Podaj wymiary.'); try { const r = pipeMass({ od: v.od, wall: v.w, length: v.l }); return { cards: [card('Masa stali', r.steelKg.toFixed(2) + ' kg'), card('Masa na metr', r.kgPerM.toFixed(2) + ' kg/m'), card('Średnica wewn.', fmt(r.id)), card('Woda w środku', r.waterL.toFixed(2) + ' l')] }; } catch (e) { return bad(e.message); } } },
  { id: 'dylat', cat: 'Przepływ i obciążenia', name: 'Dylatacja cieplna', desc: 'Wydłużenie odcinka przy zmianie temperatury.',
    fields: [LEN('l', 'Długość odcinka', 10000, 100, 100000, 100), NUM('dt', 'Zmiana temperatury (K)', 100, -100, 600, 5)],
    calc(v) { if (!(v.l > 0) || isNaN(v.dt)) return bad('Podaj dane.'); return { cards: [card('Wydłużenie', fmt(expansion({ length: v.l, dT: v.dt }).dL))], note: 'Stal węglowa, α = 12·10⁻⁶ 1/K. Dla innych materiałów wynik się różni.' }; } },
  { id: 'pach', cat: 'Spawanie', name: 'Spoina pachwinowa', desc: 'a ↔ z, stopiwo, spoina przerywana.',
    fields: [SEL('wy', 'Znasz', 'a', [['a', 'a (grubość miarodajna)'], ['z', 'z (bok)']]), NUM('x', 'Wymiar spoiny (mm)', 5, 1, 30, 0.5), NUM('l', 'Przerywana: długość odcinka (mm)', 50, 0, 500, 5), NUM('p', 'Podziałka od środka do środka (mm)', 200, 0, 1000, 10), NUM('L', 'Długość złącza (mm)', 1000, 0, 10000, 50)],
    calc(v) { if (!(v.x > 0)) return bad('Podaj wymiar spoiny.'); try { const r = fillet(Object.assign(v.wy === 'a' ? { a: v.x } : { z: v.x }, (v.l > 0 && v.p > 0 && v.L > 0) ? { len: v.l, pitch: v.p, jointLength: v.L } : {}));
      const c = [card('a', r.a.toFixed(2) + ' mm'), card('z', r.z.toFixed(2) + ' mm'), card('Pole przekroju', r.area.toFixed(1) + ' mm²'), card('Stopiwo na 1 m', r.gramsPerM.toFixed(0) + ' g')];
      if (r.count != null) c.push(card('Liczba odcinków', r.count), card('Spoiny w sumie', fmt(r.totalWeld)), card('Udział', (r.fraction * 100).toFixed(0) + ' %'), card('Stopiwo razem', r.grams.toFixed(0) + ' g'));
      return { cards: c, note: 'a6 i z6 to nie to samo złącze. Stopiwo teoretyczne (stal), bez nadlewu i strat.' }; } catch (e) { return bad(e.message); } } },
  { id: 'rowek', cat: 'Spawanie', name: 'Rowek V', desc: 'Przygotowanie złącza: szerokość, pole, stopiwo.',
    fields: [NUM('t', 'Grubość ścianki (mm)', 10, 2, 60, 0.5), ANG('A', 'Kąt rowka (całkowity)', 60, [30, 45, 60, 75], 10, 120, 1), NUM('c', 'Nadsadzka (mm)', 2, 0, 6, 0.5), NUM('g', 'Szczelina (mm)', 2, 0, 6, 0.5)],
    calc(v) { if (!(v.t > 0 && v.A > 0 && v.A < 180 && v.c >= 0 && v.g >= 0)) return bad('Podaj poprawne dane.'); try { const r = vPrep({ t: v.t, angle: v.A, root: v.c, gap: v.g });
      return { cards: [card('Szerokość lica', r.width.toFixed(1) + ' mm'), card('Głębokość rowka', r.depth.toFixed(1) + ' mm'), card('Pole rowka', r.area.toFixed(1) + ' mm²'), card('Stopiwo na 1 m', r.gramsPerM.toFixed(0) + ' g')], note: 'Stopiwo teoretyczne, bez nadlewu. Rowek J jest w planach.' }; } catch (e) { return bad(e.message); } } },
  { id: 'cieplo', cat: 'Spawanie', name: 'Wkład ciepła', desc: 'Q = k·U·I / (1000·v) wg EN 1011-1.',
    fields: [SEL('pr', 'Proces', '135', [['135', '135 MAG'], ['136', '136 MAG drut proszkowy'], ['131', '131 MIG'], ['111', '111 MMA'], ['141', '141 TIG'], ['121', '121 łuk krytyczny (SAW)'], ['15', '15 plazma']]), NUM('U', 'Napięcie U (V)', 24, 10, 50, 0.5), NUM('I', 'Prąd I (A)', 200, 30, 600, 5),
      SEL('md', 'Prędkość podajesz jako', 's', [['s', 'mm/min'], ['t', 'długość i czas']]), { ...NUM('v', 'Prędkość (mm/min)', 180, 20, 800, 5), show: v => v.md === 's' }, { ...NUM('Lw', 'Długość spoiny (mm)', 300, 10, 2000, 10), show: v => v.md === 't' }, { ...NUM('tw', 'Czas (s)', 100, 1, 600, 1), show: v => v.md === 't' }],
    calc(v) { if (!(v.U > 0 && v.I > 0)) return bad('Podaj poprawne dane.'); const sp = v.md === 's' ? v.v / 60 : null; if ((v.md === 's' && !(sp > 0)) || (v.md === 't' && !(v.Lw > 0 && v.tw > 0))) return bad('Podaj prędkość spawania.');
      const r = heatInput(v.md === 's' ? { U: v.U, I: v.I, speed: sp, process: v.pr } : { U: v.U, I: v.I, length: v.Lw, time: v.tw, process: v.pr });
      return { cards: [card('Wkład ciepła Q', r.Q.toFixed(2) + ' kJ/mm'), card('Energia łuku', r.arcEnergy.toFixed(2) + ' kJ/mm'), card('Sprawność cieplna k', r.k), card('Prędkość', (r.speed * 60).toFixed(0) + ' mm/min')], warn: 'Współczynniki k sprawdź w EN 1011-1 / WPS.' }; } },
  { id: 'podgrz', cat: 'Spawanie', name: 'Podgrzewanie wstępne', desc: 'EN 1011-2, metoda B (CET) – orientacyjnie.',
    fields: [NUM('C', 'C (%)', 0.2, 0.05, 0.3, 0.01), NUM('Mn', 'Mn (%)', 1.2, 0, 2, 0.05), NUM('Cr', 'Cr (%)', 0, 0, 1.5, 0.05), NUM('Mo', 'Mo (%)', 0, 0, 1, 0.05), NUM('Cu', 'Cu (%)', 0, 0, 1, 0.05), NUM('Ni', 'Ni (%)', 0, 0, 2, 0.05), NUM('d', 'Grubość d (mm)', 20, 5, 100, 1), NUM('HD', 'Wodór HD (ml/100 g)', 5, 1, 20, 0.5), NUM('Q', 'Wkład ciepła Q (kJ/mm)', 1, 0.3, 4.5, 0.1)],
    calc(v) { if (Object.values(v).some(x => typeof x === 'number' && (isNaN(x) || x < 0)) || !(v.d > 0 && v.HD > 0 && v.Q > 0)) return bad('Podaj poprawne dane.'); const r = preheat(v);
      return { cards: [card('CET', r.CET.toFixed(3)), card('Min. podgrzewanie', r.needed ? Math.ceil(r.Tp) + ' °C' : 'nie wymagane (≤ 20 °C)')], warn: 'Wartość orientacyjna. Obowiązuje WPS i norma: wzór ma zakresy ważności (stale C-Mn i niskostopowe, ograniczone d, Q i skład). Poza nimi nie stosuj.' }; } },
  { id: 'przedm', cat: 'Spawanie', name: 'Przedmuch gazem', desc: 'Czas i zużycie gazu przed przejściem graniowym.',
    fields: [LEN('i', 'Średnica wewnętrzna rury', 100, 10, 1000, 1), LEN('L', 'Długość przedmuchiwanego odcinka', 1000, 100, 20000, 50), NUM('f', 'Przepływ (l/min)', 10, 1, 60, 1), NUM('n', 'Krotność wymiany objętości', 5, 1, 20, 1), NUM('c', 'Cena gazu (zł za m³, opcjonalnie)', 0, 0, 500, 5)],
    calc(v) { if (!(v.i > 0 && v.L > 0 && v.f > 0 && v.n > 0)) return bad('Podaj poprawne dane.'); const r = purge({ id: v.i, length: v.L, flow: v.f, changes: v.n, pricePerM3: v.c || 0 });
      const c = [card('Objętość', r.volL.toFixed(2) + ' l'), card('Czas przedmuchu', r.timeMin.toFixed(1) + ' min'), card('Zużycie gazu', r.liters.toFixed(0) + ' l'), card('Prędkość w rurze', r.velocity.toFixed(2) + ' m/s')]; if (v.c > 0) c.push(card('Koszt gazu', r.cost.toFixed(2) + ' zł'));
      return { cards: c, note: 'Krotność 5 to wartość robocza, ustal ją w WPS. Za duży przepływ robi turbulencje i gorzej wypiera powietrze.' }; } },
  { id: 'denn', cat: 'Spawanie', name: 'Dennice', desc: 'Rozkrój krążka i wymiary: Klöpper, Korbbogen, 2:1.',
    fields: [SEL('ty', 'Typ', 'klopper', [['klopper', 'Klöpper (R = Da, r = 0,1·Da)'], ['korbbogen', 'Korbbogen (R = 0,8·Da, r = 0,154·Da)'], ['ellipse', 'Eliptyczna 2:1 (ASME)']]), LEN('Di', 'Średnica wewnętrzna', 1000, 100, 4000, 10), LEN('s', 'Grubość blachy', 10, 2, 60, 0.5), LEN('h1', 'Prosty kołnierz', 40, 0, 200, 1)],
    calc(v) { if (!(v.Di > 0 && v.s > 0 && v.h1 >= 0)) return bad('Podaj poprawne dane.'); try { const r = head({ type: v.ty, Di: v.Di, s: v.s, h1: v.h1 });
      return { cards: [card('Średnica krążka blachy', fmt(r.blank)), card('Wypukłość (wewn.)', fmt(r.dome)), card('Wysokość całkowita', fmt(r.totalHeight)), card('Promień czaszy R', r.crownR ? fmt(r.crownR) : '—'), card('Promień przejścia r', r.knuckleR ? fmt(r.knuckleR) : '—')], note: 'Krążek liczony z pola powierzchni warstwy środkowej, bez ścienienia przy tłoczeniu. Dodaj naddatek na obróbkę.', warn: 'Promienie wg DIN 28011/28013 przyjęte z pamięci. Przed zamówieniem sprawdź w katalogu producenta.' }; } catch (e) { return bad(e.message); } } },
  { id: 'skurcz', cat: 'Spawanie', name: 'Skurcz spoin', desc: 'Skurcz na ciągu rur, z kalibracją na pierwszym spoolu.',
    fields: [NUM('N', 'Liczba spoin na ciągu', 6, 1, 40, 1), NUM('ps', 'Skurcz z jednej spoiny (mm)', 1.5, 0, 5, 0.1), NUM('mt', 'Kalibracja: zmierzony skurcz razem (mm)', 0, 0, 40, 0.5), NUM('mw', 'Kalibracja: przy ilu spoinach', 0, 0, 40, 1)],
    calc(v) { if (!(v.N > 0)) return bad('Podaj liczbę spoin.'); const cal = v.mt > 0 && v.mw > 0; if (!cal && !(v.ps >= 0)) return bad('Podaj skurcz z jednej spoiny.');
      const r = shrinkage(cal ? { welds: v.N, measuredTotal: v.mt, measuredWelds: v.mw } : { welds: v.N, perWeld: v.ps }); return { cards: [card('Na jedną spoinę', r.perWeld.toFixed(2) + ' mm'), card('Skurcz razem', r.total.toFixed(1) + ' mm')], note: cal ? 'Użyto Twojej kalibracji.' : 'Wartość 1,5 mm to tylko punkt startowy. Zmierz i wpisz własną w polach kalibracji.' }; } },
  { id: 'cale', cat: 'Pomiary i konwersje', name: 'Cale ↔ mm', desc: 'Konwerter, rozumie 4\' 7 5/16".', special: 'cale' },
  { id: 'poziomica', cat: 'Pomiary i konwersje', name: 'Poziomica (czujnik telefonu)', desc: 'Przyłóż telefon do rury i odczytaj spadek.', special: 'poziomica' },
  { id: 'iso', cat: 'Izometria', name: 'Edytor izometrii', desc: 'Rysuj trasę kierunek + długość, lista cięć i dziennik spoin.', special: 'iso' }
];
const CATS = ['Kolana i przesunięcia', 'Blachy i rozwinięcia', 'Odgałęzienia', 'Przepływ i obciążenia', 'Spawanie', 'Pomiary i konwersje', 'Izometria'];
const byId = id => TOOLS.find(t => t.id === id);

// ---------- ekran główny ----------
function renderHome() {
  const cnt = TOOLS.filter(t => !t.special).length + 3;
  $('#app').innerHTML = `<section class="hero"><div><div class="eyebrow">Kalkulator dla rurarza i spawacza</div><h1>DrRobert</h1>
  <p>Odsunięcia, kolana, cięcia, spoiny i izometria. Wyniki co do milimetra, rysowane w skali, na rurze, którą trzymasz w ręku.</p>
  <div class="cta"><button class="btn" data-go="odsun">Wypróbuj kalkulator</button><button class="btn sec" data-go="iso">Edytor izometrii</button></div>
  <div class="badge">Bez reklam. Bez śledzenia. Bez konta. Wszystko działa offline.</div></div>
  <div class="vis" id="heroVis"></div></section>
  <div class="stats"><div><b>${cnt}</b><small>narzędzi</small></div><div><b>2</b><small>jednostki: mm i cale</small></div><div><b>DXF</b><small>eksport 1:1</small></div><div><b>0</b><small>reklam</small></div></div>
  <h2 class="sec">Narzędzia</h2>` +
    CATS.map(c => `<div class="catname">${c}</div><div class="grid">${TOOLS.filter(t => t.cat === c).map(t => `<button class="tc" data-go="${t.id}"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></button>`).join('')}</div>`).join('');
  const hv = { H: 260, A: 45, R: 70, OD: 53 }; $('#heroVis').innerHTML = drawOffset(hv, offset({ H: hv.H, angle: hv.A, R: hv.R }));
}

// ---------- silnik narzędzi z suwakami ----------
let cur = null;
function fieldHtml(f) {
  if (f.t === 'sel') return `<div class="f" data-f="${f.id}"><label>${esc(f.label)}</label><select data-s="${f.id}">${f.opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></div>`;
  const chips = f.chips ? `<div class="chips">${f.chips.map(c => `<button type="button" class="chip" data-chip="${f.id}" data-v="${c}">${c}°</button>`).join('')}</div>` : '';
  const sl = f.min != null ? `<input type="range" data-r="${f.id}" min="${f.min}" max="${f.max}" step="${f.step || 1}">` : '';
  return `<div class="f" data-f="${f.id}"><label>${esc(f.label)}${f.t === 'ang' ? ' (°)' : f.t === 'len' ? (unit === 'in' ? ' (cale)' : ' (mm)') : ''}</label>${chips}<div class="sl">${sl}<input class="num" data-n="${f.id}" type="text" inputmode="${f.t === 'len' && unit === 'in' ? 'text' : 'decimal'}"></div></div>`;
}
function syncField(f) {
  const v = cur.v[f.id], r = $(`[data-r="${f.id}"]`), n = $(`[data-n="${f.id}"]`), s = $(`[data-s="${f.id}"]`);
  if (r && !isNaN(v)) r.value = v;
  if (n && document.activeElement !== n) n.value = isNaN(v) ? '' : (f.t === 'len' ? fmtIn(v) : String(Math.round(v * 1000) / 1000));
  if (s) s.value = v;
  $$(`[data-chip="${f.id}"]`).forEach(b => b.classList.toggle('on', Math.abs(+b.dataset.v - v) < 1e-9));
}
function setHash(t) {
  const q = t.fields.map(f => `${f.id}=${encodeURIComponent(cur.v[f.id])}`).join('&');
  try { history.replaceState(null, '', `#/t/${t.id}?${q}`); } catch (e) {}
}
function updateTool() {
  const t = cur.t; let o;
  t.fields.forEach(f => { const el = $(`[data-f="${f.id}"]`); if (el) el.style.display = (!f.show || f.show(cur.v)) ? '' : 'none'; });
  try { o = t.calc(cur.v); } catch (e) { o = bad(e.message); }
  cur.out = o;
  $('#vis').style.display = o.svg ? '' : 'none'; $('#vis').innerHTML = o.svg || '';
  $('#cards').innerHTML = (o.cards || []).map(([l, v]) => `<div class="cd"><small>${esc(l)}</small><b>${esc(v)}</b></div>`).join('');
  $('#msg').innerHTML = (o.error ? `<p class="err">${esc(o.error)}</p>` : '') + (o.note ? `<p class="note">${esc(o.note)}</p>` : '') + (o.warn ? `<p class="warn">${esc(o.warn)}</p>` : '');
  $('#tbl').innerHTML = o.table ? `<div class="box tw" style="margin-top:14px"><table><tr>${o.table.head.map(h => `<th>${h}</th>`).join('')}</tr>${o.table.rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>` : '';
  $('#act').innerHTML = o.dxf ? `<button class="btn" id="dxf">Pobierz DXF 1:1</button>` : '';
  if (o.dxf) $('#dxf').onclick = () => download(o.dxf.name, o.dxf.text, 'application/dxf');
  setHash(t);
}
function renderTool(t, params) {
  if (t.special) return renderSpecial(t);
  cur = { t, v: {} };
  t.fields.forEach(f => { let x = f.t === 'sel' ? f.def : f.def; if (params && params.has(f.id)) { const raw = params.get(f.id); x = f.t === 'sel' ? raw : parseFloat(raw); if (f.t !== 'sel' && isNaN(x)) x = f.def; } cur.v[f.id] = (f.t === 'sel' && typeof f.def === 'number') ? +x : x; });
  $('#app').innerHTML = `<div class="tool"><button class="hb back" data-go="">← Narzędzia</button><h1>${esc(t.name)}</h1><p class="d">${esc(t.desc)}</p>
  <div class="layout"><div class="panel">${t.fields.map(fieldHtml).join('')}</div><div><div class="vis" id="vis"></div></div></div>
  <div class="cards" id="cards"></div><div id="msg"></div><div id="tbl"></div><div class="actions" id="act"></div></div>`;
  t.fields.forEach(f => syncField(f));
  const P = $('.panel');
  P.addEventListener('input', e => {
    const el = e.target, f = id => t.fields.find(x => x.id === id);
    if (el.dataset.r) { cur.v[el.dataset.r] = parseFloat(el.value); syncField(f(el.dataset.r)); }
    else if (el.dataset.n) { const ff = f(el.dataset.n), x = ff.t === 'len' ? parseLen(el.value) : parseNum(el.value); if (!isNaN(x)) { cur.v[ff.id] = x; const r = $(`[data-r="${ff.id}"]`); if (r) r.value = x; $$(`[data-chip="${ff.id}"]`).forEach(b => b.classList.toggle('on', Math.abs(+b.dataset.v - x) < 1e-9)); } else cur.v[ff.id] = NaN; }
    else if (el.dataset.s) { const ff = f(el.dataset.s); cur.v[ff.id] = typeof ff.def === 'number' ? +el.value : el.value; }
    updateTool();
  });
  P.addEventListener('click', e => { const b = e.target.closest('[data-chip]'); if (!b) return; const ff = t.fields.find(x => x.id === b.dataset.chip); cur.v[ff.id] = +b.dataset.v; syncField(ff); updateTool(); });
  updateTool();
}

// ---------- narzędzia specjalne (cale) ----------
function renderSpecial(t) {
  if (t.special === 'cale') {
    $('#app').innerHTML = `<div class="tool"><button class="hb back" data-go="">← Narzędzia</button><h1>${esc(t.name)}</h1><p class="d">${esc(t.desc)}</p><div class="panel" style="max-width:520px">
    <label>Cale / stopy (np. 4' 7 5/16")</label><input class="num" id="ca" style="text-align:left" value="4' 7 5/16&quot;"><label>Milimetry</label><input class="num" id="cb" style="text-align:left" inputmode="decimal" value="1404.9"></div></div>`;
    $('#ca').oninput = () => { const mm = parseInches($('#ca').value); if (!isNaN(mm)) $('#cb').value = mm.toFixed(2); };
    $('#cb').oninput = () => { const mm = parseNum($('#cb').value); if (!isNaN(mm)) $('#ca').value = toFeetInches(mm); };
    try { history.replaceState(null, '', '#/t/cale'); } catch (e) {}
  } else if (t.special === 'poziomica') renderLevel(t);
  else if (t.special === 'iso') renderIso(t);
}

// ---------- router ----------
function route() {
  window.scrollTo(0, 0);
  const h = location.hash || '#/';
  const m = h.match(/^#\/(t|iso)(?:\/([\w-]+))?(?:\?(.*))?$/);
  if (!m) return renderHome();
  const params = new URLSearchParams(m[3] || '');
  if (m[1] === 'iso') return renderIso(byId('iso'), params);
  const t = byId(m[2]); if (!t) return renderHome(); renderTool(t, params);
}
function go(id) { location.hash = id ? (id === 'iso' ? '#/iso' : '#/t/' + id) : '#/'; }
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { e.preventDefault(); const id = b.dataset.go; if (location.hash === (id ? (id === 'iso' ? '#/iso' : '#/t/' + id) : '#/')) route(); else go(id); } });
window.addEventListener('hashchange', route);
$('#home').onclick = () => go('');
const setU = () => { $('#u').textContent = unit === 'mm' ? 'mm' : 'cale'; };
$('#u').onclick = () => { unit = unit === 'mm' ? 'in' : 'mm'; store('dr_unit', unit); setU(); route(); };
$('#share').onclick = async () => {
  const url = location.href;
  try { if (navigator.share) { await navigator.share({ title: 'DrRobert', url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Link skopiowany'); } catch (e) { prompt('Skopiuj link:', url); }
};
setU(); route();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js');
