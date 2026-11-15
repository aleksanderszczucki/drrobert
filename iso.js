'use strict';
/* DrRobert – edytor izometrii i poziomica. Własny kod. Zależy od calc.js i app.js. */
const ISO_NAMES = { E: 'Wschód', W: 'Zachód', N: 'Północ', S: 'Południe', U: 'Góra', D: 'Dół' };
const ISO_PAD = [['W', '↖ Zachód'], ['U', '↑ Góra'], ['N', '↗ Północ'], ['S', '↙ Południe'], ['D', '↓ Dół'], ['E', '↘ Wschód']];
const ISO_LEN = [250, 500, 1000, 1500, 2000, 3000];
const WELD_STATUS = ['do wykonania', 'wykonana', 'badanie OK', 'naprawa'];
let iso = { dn: 100, series: 'LR', z: 0, len: 1000, segs: [], welds: {} };

function isoLoad(params) {
  let s = null;
  try { if (params && params.get('d')) s = JSON.parse(decodeURIComponent(escape(atob(params.get('d'))))); } catch (e) { s = null; }
  if (!s) { try { s = JSON.parse(load('dr_iso')); } catch (e) { s = null; } }
  if (s && Array.isArray(s.segs)) iso = Object.assign({ dn: 100, series: 'LR', z: 0, len: 1000, segs: [], welds: {} }, s);
}
function isoSave() {
  const j = JSON.stringify(iso); store('dr_iso', j);
  try { history.replaceState(null, '', '#/iso?d=' + encodeURIComponent(btoa(unescape(encodeURIComponent(j))))); } catch (e) {}
}
const isoProj = p => [0.866 * (p[0] + p[1]), 0.5 * (p[0] - p[1]) - p[2]];
const mmFmt = x => (Math.round(x * 10) / 10).toString();
const elTxt = z => 'EL ' + (z >= 0 ? '+' : '') + mmFmt(z);

function isoDraw(a) {
  const W = 760, H = 440, P = a.points.map(isoProj);
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const dx = maxx - minx || 1, dy = maxy - miny || 1, k = Math.min((W - 160) / dx, (H - 140) / dy, 0.5);
  const ox = (W - dx * k) / 2 - minx * k, oy = (H - dy * k) / 2 - miny * k + 10;
  const S = p => [ox + p[0] * k, oy + p[1] * k], f = p => p.map(x => x.toFixed(1)).join(' ');
  const poly = P.map((p, i) => (i ? 'L' : 'M') + f(S(p))).join('');
  let g = `<path d="${poly}" fill="none" stroke="#9db4cc" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/><path d="${poly}" fill="none" stroke="#2b3f55" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/><path d="${poly}" fill="none" stroke="${COL.g}" stroke-width="1.4" stroke-dasharray="6 4" stroke-linejoin="round"/>`;
  // wymiary odcinków
  a.segs.forEach((s, i) => {
    const m = [(S(P[i])[0] + S(P[i + 1])[0]) / 2, (S(P[i])[1] + S(P[i + 1])[1]) / 2];
    g += lbl(m[0], m[1] - 20, mmFmt(s.len), COL.o);
  });
  // kolana
  for (let i = 1; i < P.length - 1; i++) { const q = S(P[i]); g += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="4.5" fill="#0b1118" stroke="${COL.o}" stroke-width="2"/>`; }
  // rzędne
  let lastZ = null;
  a.points.forEach((p, i) => { if (lastZ === null || p[2] !== lastZ || i === a.points.length - 1) { const q = S(P[i]); g += lbl(q[0] + (i ? 4 : -4), q[1] + (i ? 22 : -18), elTxt(p[2]), COL.b); } lastZ = p[2]; });
  // numery spoin (przy kolanach)
  let wn = 0;
  for (let i = 1; i < a.segs.length; i++) {
    const d0 = ISO_DIR[a.segs[i - 1].dir], d1 = ISO_DIR[a.segs[i].dir], v = a.points[i], A_ = a.elbowA;
    [[-1, d0], [1, d1]].forEach(([sg, d]) => { wn++; const pt = [v[0] + sg * d[0] * A_, v[1] + sg * d[1] * A_, v[2] + sg * d[2] * A_], q = S(isoProj(pt));
      g += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="9" fill="#0b1118" stroke="${COL.r}" stroke-width="1.6"/><text x="${q[0].toFixed(1)}" y="${(q[1] + 4).toFixed(1)}" text-anchor="middle" fill="${COL.r}" font-size="11" font-family="ui-monospace,monospace" font-weight="700">${wn}</text>`; });
  }
  // strzałka północy
  g += `<line x1="690" y1="80" x2="${690 + 0.866 * 38}" y2="${80 - 0.5 * 38}" stroke="${COL.g}" stroke-width="2" marker-end="url(#ag)"/>` + lbl(690 + 0.866 * 38 + 14, 80 - 19 - 10, 'N', COL.g);
  g += `<text x="16" y="${H - 14}" fill="#8a9bb0" font-size="12" font-family="ui-monospace,monospace">DN${iso.dn} · kolana ${iso.series} · wymiary środek–środek w mm · rysunek bez skali</text>`;
  return svgWrap(W, H, g);
}

function isoCsv(a) {
  const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
  const rows = [['LISTA CIĘĆ'], ['Nr', 'Kierunek', 'Środek-środek [mm]', 'Odliczenie [mm]', 'Długość cięcia [mm]']];
  a.cuts.forEach((c, i) => rows.push([i + 1, ISO_NAMES[c.dir], mmFmt(c.center), mmFmt(c.takeStart + c.takeEnd), mmFmt(c.cut)]));
  rows.push([], ['DZIENNIK SPOIN'], ['Nr', 'Pozycja', 'Spawacz', 'WPS', 'Data', 'Badanie', 'Status']);
  a.welds.forEach((w, i) => { const x = iso.welds[i + 1] || {}; rows.push([i + 1, `kolano ${w.elbow} – ${w.side}`, x.welder || '', x.wps || '', x.date || '', x.vt || '', x.status || WELD_STATUS[0]]); });
  return '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n') + '\r\n';
}

function isoUpdate() {
  let a;
  try { a = isoAnalyze({ segs: iso.segs, dn: iso.dn, series: iso.series, start: [0, 0, iso.z] }); }
  catch (e) { $('#isoMsg').innerHTML = `<p class="err">${esc(e.message)}</p>`; return false; }
  $('#isoMsg').innerHTML = a.tooShort ? '<p class="err">Uwaga: któryś odcinek jest za krótki na dwa kolana (długość cięcia ≤ 0).</p>' : '';
  if (!iso.segs.length) {
    $('#isoVis').innerHTML = svgWrap(760, 200, `<text x="380" y="105" text-anchor="middle" fill="#8a9bb0" font-size="15">Wybierz długość i dotknij kierunku, aby narysować pierwszy odcinek.</text>`);
    $('#isoOut').innerHTML = ''; isoSave(); return true;
  }
  $('#isoVis').innerHTML = isoDraw(a);
  const total = a.segs.reduce((s, x) => s + x.len, 0);
  const cuts = a.cuts.map((c, i) => `<tr><td>${i + 1}</td><td>${ISO_NAMES[c.dir]}</td><td>${mmFmt(c.center)}</td><td>${mmFmt(c.takeStart + c.takeEnd)}</td><td style="color:${c.cut <= 0 ? COL.r : COL.g};font-weight:700">${mmFmt(c.cut)}</td></tr>`).join('');
  const welds = a.welds.map((w, i) => { const x = iso.welds[i + 1] || {}; return `<tr><td>${i + 1}</td><td style="text-align:left">kolano ${w.elbow} – ${w.side}</td><td><input data-w="${i + 1}" data-k="welder" value="${esc(x.welder || '')}" placeholder="spawacz"></td><td><input data-w="${i + 1}" data-k="wps" value="${esc(x.wps || '')}" placeholder="WPS"></td><td><input type="date" data-w="${i + 1}" data-k="date" value="${esc(x.date || '')}"></td><td><input data-w="${i + 1}" data-k="vt" value="${esc(x.vt || '')}" placeholder="badanie"></td><td><select data-w="${i + 1}" data-k="status">${WELD_STATUS.map(s => `<option${(x.status || WELD_STATUS[0]) === s ? ' selected' : ''}>${s}</option>`).join('')}</select></td></tr>`; }).join('');
  $('#isoOut').innerHTML = `<div class="cards"><div class="cd"><small>Rura razem (cięcia)</small><b>${(a.pipeTotal / 1000).toFixed(3)} m</b></div><div class="cd"><small>Kolana 90° DN${iso.dn} ${iso.series}</small><b>${a.elbows} szt.</b></div><div class="cd"><small>Spoiny (rura–kolano)</small><b>${a.welds.length}</b></div><div class="cd"><small>Trasa środek–środek</small><b>${mmFmt(total)} mm</b></div></div>
  <div class="box tw" style="margin-top:14px"><h3 style="margin:0 0 8px">Lista cięć</h3><table><tr><th>Nr</th><th>Kierunek</th><th>Środek–środek</th><th>Odliczenie</th><th>Długość cięcia</th></tr>${cuts}</table><p class="note">Odliczenie = środek–koniec kolana (ASME B16.9: LR 1,5·NPS, SR 1·NPS). Dla kolan wg EN 10253 sprawdź wymiary u producenta.</p></div>
  ${a.welds.length ? `<div class="box tw" style="margin-top:14px"><h3 style="margin:0 0 8px">Dziennik spoin</h3><table><tr><th>Nr</th><th>Pozycja</th><th>Spawacz</th><th>WPS</th><th>Data</th><th>Badanie</th><th>Status</th></tr>${welds}</table></div>` : ''}`;
  isoSave(); return true;
}

function renderIso(t, params) {
  isoLoad(params);
  $('#app').innerHTML = `<div class="tool"><button class="hb back" data-go="">← Narzędzia</button><h1>Edytor izometrii</h1><p class="d">Wybierz długość i dotknij kierunku. Kolana ustawiają się same, lista cięć i dziennik spoin liczą się na żywo. Rysunek zapisuje się w tej przeglądarce.</p>
  <div class="layout"><div class="panel"><div class="f"><label>Średnica</label><select id="isoDn">${DN_TABLE.map(r => `<option value="${r.dn}"${r.dn === iso.dn ? ' selected' : ''}>DN ${r.dn} (Ø ${r.od})</option>`).join('')}</select></div>
  <div class="f"><label>Seria kolan</label><select id="isoSe"><option value="LR"${iso.series === 'LR' ? ' selected' : ''}>Długie (LR)</option><option value="SR"${iso.series === 'SR' ? ' selected' : ''}>Krótkie (SR)</option></select></div>
  <div class="f"><label>Rzędna początku EL (mm)</label><input class="num" style="text-align:left" id="isoZ" inputmode="decimal" value="${iso.z}"></div>
  <div class="f"><label>Długość odcinka (mm)</label><div class="chips">${ISO_LEN.map(x => `<button type="button" class="chip" data-il="${x}">${x}</button>`).join('')}</div><input class="num" style="text-align:left" id="isoL" inputmode="decimal" value="${iso.len}"></div>
  <div class="f"><label>Kierunek (dotknij, aby dodać)</label><div class="pad">${ISO_PAD.map(([d, l]) => `<button type="button" data-id="${d}">${l}</button>`).join('')}</div></div>
  <div class="actions"><button class="btn sec" id="isoUndo">Cofnij</button><button class="btn sec" id="isoClear">Wyczyść</button></div></div>
  <div><div class="vis" id="isoVis"></div><div id="isoMsg"></div></div></div>
  <div id="isoOut"></div>
  <div class="actions"><button class="btn" id="isoPrint">Drukuj / zapisz PDF</button><button class="btn sec" id="isoCsv">Pobierz CSV (cięcia + spoiny)</button></div></div>`;
  const mark = () => $$('[data-il]').forEach(b => b.classList.toggle('on', +b.dataset.il === iso.len));
  const readLen = () => { const x = parseNum($('#isoL').value); return x > 0 ? x : null; };
  $('#isoDn').onchange = e => { iso.dn = +e.target.value; isoUpdate(); };
  $('#isoSe').onchange = e => { iso.series = e.target.value; isoUpdate(); };
  $('#isoZ').oninput = e => { const z = parseNum(e.target.value); if (!isNaN(z)) { iso.z = z; isoUpdate(); } };
  $('#isoL').oninput = () => { const x = readLen(); if (x) iso.len = x; mark(); };
  $$('[data-il]').forEach(b => b.onclick = () => { iso.len = +b.dataset.il; $('#isoL').value = iso.len; mark(); });
  $$('.pad [data-id]').forEach(b => b.onclick = () => {
    const x = readLen(); if (!x) { toast('Podaj długość odcinka'); return; }
    iso.segs.push({ dir: b.dataset.id, len: x });
    if (!isoUpdate()) { iso.segs.pop(); isoUpdate(); toast('Tego odcinka nie da się dodać'); }
  });
  $('#isoUndo').onclick = () => { iso.segs.pop(); iso.welds = {}; isoUpdate(); };
  $('#isoClear').onclick = () => { iso.segs = []; iso.welds = {}; isoUpdate(); };
  $('#isoPrint').onclick = () => window.print();
  $('#isoCsv').onclick = () => { try { const a = isoAnalyze({ segs: iso.segs, dn: iso.dn, series: iso.series, start: [0, 0, iso.z] }); if (!iso.segs.length) { toast('Najpierw narysuj trasę'); return; } download('izometria.csv', isoCsv(a), 'text/csv;charset=utf-8'); } catch (e) { toast(e.message); } };
  $('#isoOut').addEventListener('input', e => { const el = e.target; if (!el.dataset.w) return; const n = el.dataset.w; iso.welds[n] = Object.assign(iso.welds[n] || {}, { [el.dataset.k]: el.value }); isoSave(); });
  mark(); isoUpdate();
}

// ---------- poziomica ----------
let levelHandler = null;
function renderLevel(t) {
  if (levelHandler) { window.removeEventListener('deviceorientation', levelHandler); levelHandler = null; }
  $('#app').innerHTML = `<div class="tool"><button class="hb back" data-go="">← Narzędzia</button><h1>${esc(t.name)}</h1><p class="d">${esc(t.desc)}</p>
  <div class="layout"><div class="panel"><div class="f"><label>Oś pomiaru</label><select id="lvAx"><option value="b">Wzdłuż telefonu (przód–tył)</option><option value="g">W poprzek telefonu (lewo–prawo)</option></select></div>
  <div class="actions"><button class="btn" id="lvOn">Włącz czujnik</button><button class="btn sec" id="lvZero">Zeruj</button></div>
  <p class="note">Połóż telefon płasko na rurze lub na desce przyłożonej do rury. Wciśnij „Zeruj” na poziomej powierzchni, aby skalibrować.</p></div>
  <div class="box"><div class="cards" id="lvCards" style="margin:0"><div class="cd"><small>Kąt</small><b>—</b></div></div><p class="note" id="lvMsg">Czujnik jest wyłączony.</p></div></div></div>`;
  let off = 0, raw = null, got = false;
  const show = () => {
    if (raw == null) return;
    const ang = raw - off, r = Math.abs(ang) > 0.005 ? slope({ type: 'deg', value: Math.abs(ang) }) : { percent: 0, mmPerM: 0, ratio: Infinity };
    $('#lvCards').innerHTML = [['Kąt', ang.toFixed(2) + '°'], ['Spadek', r.percent.toFixed(2) + ' %'], ['mm na metr', r.mmPerM.toFixed(1)], ['1 : n', isFinite(r.ratio) ? '1 : ' + r.ratio.toFixed(0) : '—']].map(([l, v]) => `<div class="cd"><small>${l}</small><b>${v}</b></div>`).join('');
  };
  $('#lvOn').onclick = async () => {
    try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) { const p = await DeviceOrientationEvent.requestPermission(); if (p !== 'granted') { $('#lvMsg').textContent = 'Brak zgody na czujnik ruchu.'; return; } } } catch (e) { $('#lvMsg').textContent = 'Nie udało się uzyskać dostępu do czujnika.'; return; }
    if (levelHandler) window.removeEventListener('deviceorientation', levelHandler);
    levelHandler = e => { if (!$('#lvAx')) { window.removeEventListener('deviceorientation', levelHandler); levelHandler = null; return; } const v = $('#lvAx').value === 'b' ? e.beta : e.gamma; if (v == null) return; got = true; raw = v; $('#lvMsg').textContent = 'Czujnik działa.'; show(); };
    window.addEventListener('deviceorientation', levelHandler); $('#lvMsg').textContent = 'Czekam na dane z czujnika…';
    setTimeout(() => { if (!got && $('#lvMsg')) $('#lvMsg').textContent = 'Brak danych z czujnika. To urządzenie lub przeglądarka go nie udostępnia (poziomica działa na telefonie, przez https).'; }, 2500);
  };
  $('#lvZero').onclick = () => { if (raw != null) { off = raw; show(); } else toast('Najpierw włącz czujnik'); };
  try { history.replaceState(null, '', '#/t/poziomica'); } catch (e) {}
}
// route() z app.js woła renderIso(t, params); renderLevel wołane z renderSpecial.
