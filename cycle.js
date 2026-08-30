/* ============ Döngü (regl) takibi 🌸 ============ */

(function () {
  'use strict';

  const FLOWS = [
    { v: 0, label: 'Yok',        dot: '' },
    { v: 4, label: 'Lekelenme',  dot: '·' },
    { v: 1, label: 'Hafif',      dot: '💧' },
    { v: 2, label: 'Orta',       dot: '💧💧' },
    { v: 3, label: 'Yoğun',      dot: '💧💧💧' }
  ];
  const SYMPTOMS = ['Kramp', 'Baş ağrısı', 'Bel ağrısı', 'Şişkinlik', 'Hassas göğüs', 'Akne', 'Yorgunluk', 'Uykusuzluk', 'Bulantı', 'İştah artışı', 'Baş dönmesi', 'Sırt ağrısı'];
  const MOODS = ['Harika', 'Mutlu', 'Sakin', 'Enerjik', 'Duygusal', 'Sinirli', 'Kaygılı', 'Üzgün', 'Yorgun'];

  const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const GUN = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pa'];
  const DAY = 86400000;

  const $id = (x) => document.getElementById(x);
  const key = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const fromKey = (k) => { const p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  const today0 = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };

  let viewYear, viewMonth;      // takvimde gösterilen ay
  let editKey = null;           // düzenlenen gün
  let editEntry = null;

  // ---------- döngü analizi ----------
  function analyze() {
    const cyc = AppSync.getCycle();
    const meta = AppSync.getMeta();

    // regl günleri (lekelenme hariç)
    const days = Object.keys(cyc).filter((k) => cyc[k] && cyc[k].f >= 1 && cyc[k].f <= 3).sort();

    // ardışık günleri dönemlere grupla (1 gün boşluğa tolerans)
    const periods = [];
    let cur = null;
    for (const k of days) {
      const t = fromKey(k).getTime();
      if (cur && t - cur.end <= 2 * DAY) { cur.end = t; cur.len++; }
      else { cur = { start: t, end: t, len: 1 }; periods.push(cur); }
    }

    // döngü uzunlukları (ardışık başlangıçlar arası, 15-60 gün mantıklı aralık)
    const cycleLens = [];
    for (let i = 1; i < periods.length; i++) {
      const d = Math.round((periods[i].start - periods[i - 1].start) / DAY);
      if (d >= 15 && d <= 60) cycleLens.push(d);
    }
    const last6 = cycleLens.slice(-6);
    const avg = (a) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;

    const cycleLen = meta.cycleLen || avg(last6) || 28;
    const periodLens = periods.slice(-6).map((p) => Math.min(p.len, 10));
    const periodLen = meta.periodLen || avg(periodLens) || 5;

    // düzensizlik: son döngülerde 7+ gün oynama
    const irregular = last6.length >= 3 && (Math.max(...last6) - Math.min(...last6) >= 7);

    const lastStart = periods.length ? new Date(periods[periods.length - 1].start) : null;

    // tahminler: sonraki 3 döngü
    const predictions = [];
    if (lastStart) {
      for (let k2 = 1; k2 <= 3; k2++) {
        const start = new Date(lastStart.getTime() + k2 * cycleLen * DAY);
        const ovu = new Date(start.getTime() - 14 * DAY);
        predictions.push({
          start, len: periodLen, ovu,
          fertileFrom: new Date(ovu.getTime() - 5 * DAY),
          fertileTo: new Date(ovu.getTime() + 1 * DAY),
          pmsFrom: new Date(start.getTime() - 3 * DAY)
        });
      }
    }
    return { periods, cycleLens, last6, cycleLen, periodLen, irregular, lastStart, predictions };
  }

  function dayFlags(d, A) {
    const k = key(d);
    const e = AppSync.getCycle()[k];
    const f = { period: e && e.f >= 1 && e.f <= 3, spot: e && e.f === 4, flow: e ? e.f : 0, logged: e && ((e.s && e.s.length) || (e.m && e.m.length) || e.n) };
    const t = d.getTime();
    for (const p of A.predictions) {
      if (t >= p.start.getTime() && t < p.start.getTime() + p.len * DAY) f.predicted = true;
      if (t >= p.fertileFrom.getTime() && t <= p.fertileTo.getTime()) f.fertile = true;
      if (key(p.ovu) === k) f.ovu = true;
      if (t >= p.pmsFrom.getTime() && t < p.start.getTime()) f.pms = true;
    }
    return f;
  }

  // ---------- durum kartı ----------
  function statusCard(A) {
    const t = today0();
    const cyc = AppSync.getCycle();
    const e = cyc[key(t)];

    if (e && e.f >= 1 && e.f <= 3) {
      // regl kaçıncı gün
      let n = 1, d = new Date(t.getTime() - DAY);
      while (cyc[key(d)] && cyc[key(d)].f >= 1 && cyc[key(d)].f <= 3) { n++; d = new Date(d.getTime() - DAY); }
      return { big: 'Regl — ' + n + '. gün', sub: 'Kendine iyi bak, bol su ve dinlenme. 🌷', cls: 'ph-period' };
    }
    if (!A.lastStart) return { big: 'Hoş geldin 🌸', sub: 'Takvimden regl günlerini işaretlemeye başla; tahminler birkaç kayıttan sonra netleşir.', cls: '' };

    const p = A.predictions[0];
    const kalan = Math.ceil((p.start.getTime() - t.getTime()) / DAY);
    if (kalan < 0) return { big: Math.abs(kalan) + ' gün gecikme', sub: 'Tahmini tarih geçti — regl başladıysa takvimden işaretle.', cls: 'ph-late' };
    if (kalan === 0) return { big: 'Bugün başlayabilir', sub: 'Tahmini regl günü bugün. Başladıysa takvimden işaretle. 🌷', cls: 'ph-pms' };

    const tt = t.getTime();
    if (key(p.ovu) === key(t)) return { big: 'Yumurtlama günü', sub: 'Döngünün tam ortası. Regl\'e ~' + kalan + ' gün var.', cls: 'ph-ovu' };
    if (tt >= p.fertileFrom.getTime() && tt <= p.fertileTo.getTime())
      return { big: 'Doğurgan pencere', sub: 'Regl\'e ~' + kalan + ' gün var.', cls: 'ph-fertile' };
    if (tt >= p.pmsFrom.getTime())
      return { big: 'Regl\'e ' + kalan + ' gün', sub: 'PMS penceresi — hassasiyet normal, çikolata serbest. 🍫', cls: 'ph-pms' };
    const phase = tt < p.fertileFrom.getTime() ? 'Foliküler faz' : 'Luteal faz';
    return { big: 'Regl\'e ' + kalan + ' gün', sub: phase + ' — enerji ' + (phase === 'Foliküler faz' ? 'yükselişte 💪' : 'düşüşe geçebilir, nazik ol kendine 🌙'), cls: '' };
  }

  // ---------- takvim ----------
  function renderCalendar(A) {
    $id('cy-month-label').textContent = AY[viewMonth] + ' ' + viewYear;
    const grid = $id('cy-grid');
    grid.innerHTML = GUN.map((g) => '<div class="cy-dow">' + g + '</div>').join('');

    const first = new Date(viewYear, viewMonth, 1);
    let lead = (first.getDay() + 6) % 7;   // Pazartesi başlangıç
    const daysIn = new Date(viewYear, viewMonth + 1, 0).getDate();
    const t0 = today0().getTime();

    for (let i = 0; i < lead; i++) grid.insertAdjacentHTML('beforeend', '<div></div>');

    for (let d = 1; d <= daysIn; d++) {
      const date = new Date(viewYear, viewMonth, d);
      const f = dayFlags(date, A);
      let cls = 'cy-day';
      if (f.period) cls += ' cy-period cy-flow' + f.flow;
      else if (f.spot) cls += ' cy-spot';
      else if (f.predicted) cls += ' cy-predicted';
      if (date.getTime() === t0) cls += ' cy-today';
      if (date.getTime() > t0) cls += ' cy-future';

      let marks = '';
      if (f.ovu) marks = '<span class="cy-mark">✦</span>';
      else if (f.fertile) marks = '<span class="cy-mark cy-mark-f">•</span>';
      else if (f.pms && !f.period && !f.predicted) marks = '<span class="cy-mark cy-mark-p">•</span>';
      if (f.logged) marks += '<span class="cy-mark cy-mark-note">▪</span>';

      grid.insertAdjacentHTML('beforeend',
        '<button class="' + cls + '" data-k="' + key(date) + '"><span>' + d + '</span>' + marks + '</button>');
    }

    grid.querySelectorAll('.cy-day').forEach((b) => b.addEventListener('click', () => openEditor(b.dataset.k)));
  }

  // ---------- istatistik ----------
  function renderStats(A) {
    $id('cy-stat-cycle').textContent = A.cycleLen + ' gün';
    $id('cy-stat-period').textContent = A.periodLen + ' gün';
    const next = A.predictions[0];
    $id('cy-stat-next').textContent = next ? next.start.getDate() + ' ' + AY[next.start.getMonth()] : '—';

    const bars = $id('cy-bars');
    if (!A.last6.length) { bars.innerHTML = '<p class="cy-empty">Son döngüler burada görünecek.</p>'; }
    else {
      const max = Math.max(...A.last6, 35);
      bars.innerHTML = A.last6.map((v) =>
        '<div class="cy-bar-wrap"><div class="cy-bar" style="height:' + Math.round(v / max * 100) + '%"></div><label>' + v + '</label></div>'
      ).join('');
    }
    $id('cy-irregular').classList.toggle('hidden', !A.irregular);
  }

  // ---------- gün düzenleyici ----------
  function openEditor(k) {
    editKey = k;
    const cur = AppSync.getCycle()[k];
    editEntry = cur ? JSON.parse(JSON.stringify(cur)) : { f: 0, s: [], m: [], n: '' };
    editEntry.s = editEntry.s || []; editEntry.m = editEntry.m || [];

    const d = fromKey(k);
    $id('cyd-title').textContent = d.getDate() + ' ' + AY[d.getMonth()] + ' ' + d.getFullYear();

    $id('cyd-flow').innerHTML = FLOWS.map((f) =>
      '<button class="chip' + (editEntry.f === f.v ? ' on' : '') + '" data-f="' + f.v + '">' + f.label + (f.dot ? ' ' + f.dot : '') + '</button>').join('');
    $id('cyd-sym').innerHTML = SYMPTOMS.map((s) =>
      '<button class="chip' + (editEntry.s.includes(s) ? ' on' : '') + '" data-s="' + s + '">' + s + '</button>').join('');
    $id('cyd-mood').innerHTML = MOODS.map((m) =>
      '<button class="chip' + (editEntry.m.includes(m) ? ' on' : '') + '" data-m="' + m + '">' + m + '</button>').join('');
    $id('cyd-note').value = editEntry.n || '';
    $id('cyd-delete').classList.toggle('hidden', !cur);

    $id('cyd-flow').querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      editEntry.f = +b.dataset.f;
      $id('cyd-flow').querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', +x.dataset.f === editEntry.f));
    }));
    $id('cyd-sym').querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      const s = b.dataset.s;
      editEntry.s.includes(s) ? editEntry.s.splice(editEntry.s.indexOf(s), 1) : editEntry.s.push(s);
      b.classList.toggle('on');
    }));
    $id('cyd-mood').querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      const m = b.dataset.m;
      editEntry.m.includes(m) ? editEntry.m.splice(editEntry.m.indexOf(m), 1) : editEntry.m.push(m);
      b.classList.toggle('on');
    }));

    $id('cycle-modal').classList.remove('hidden');
  }

  function saveEditor() {
    editEntry.n = $id('cyd-note').value.trim();
    const empty = editEntry.f === 0 && !editEntry.s.length && !editEntry.m.length && !editEntry.n;
    if (empty) AppSync.deleteCycleDay(editKey);
    else AppSync.saveCycleDay(editKey, editEntry);
    $id('cycle-modal').classList.add('hidden');
  }

  // ---------- ana render ----------
  function render() {
    const A = analyze();
    const st = statusCard(A);
    const card = $id('cy-status');
    card.className = 'cy-status ' + st.cls;
    $id('cy-status-big').textContent = st.big;
    $id('cy-status-sub').textContent = st.sub;
    renderCalendar(A);
    renderStats(A);
  }

  // ---------- döngü ayarları (istatistiklere dokununca açılır) ----------
  function openCycleSettings() {
    const meta = AppSync.getMeta();
    $id('cy-set-cycle').value = meta.cycleLen || '';
    $id('cy-set-period').value = meta.periodLen || '';
    $id('cyset-modal').classList.remove('hidden');
  }

  function saveCycleSettings() {
    const clamp = (id, min, max) => {
      const v = parseInt($id(id).value, 10);
      return isNaN(v) ? null : Math.max(min, Math.min(max, v));
    };
    AppSync.saveMeta({
      cycleLen: clamp('cy-set-cycle', 15, 60),
      periodLen: clamp('cy-set-period', 1, 10)
    });
    $id('cyset-modal').classList.add('hidden');
    render();
  }

  function init() {
    const t = new Date();
    viewYear = t.getFullYear(); viewMonth = t.getMonth();

    $id('cy-stats').addEventListener('click', openCycleSettings);
    $id('cyset-save').addEventListener('click', saveCycleSettings);
    $id('cyset-close').addEventListener('click', () => $id('cyset-modal').classList.add('hidden'));

    $id('cy-prev').addEventListener('click', () => { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } render(); });
    $id('cy-next').addEventListener('click', () => { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } render(); });
    $id('cyd-save').addEventListener('click', saveEditor);
    $id('cyd-delete').addEventListener('click', () => { AppSync.deleteCycleDay(editKey); $id('cycle-modal').classList.add('hidden'); });
    $id('cyd-close').addEventListener('click', () => $id('cycle-modal').classList.add('hidden'));

    AppSync.on('cycle', render);
    render();
  }

  window.Cycle = { init, render };
  init();
})();
