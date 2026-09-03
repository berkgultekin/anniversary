/* ============ Rutinler ve yapılacaklar ✅ ============ */

(function () {
  'use strict';

  const PRIO_LABEL = { 5: 'Çok acil', 4: 'Acil', 3: 'Normal', 2: 'Acele yok', 1: 'Belki' };
  const $id = (x) => document.getElementById(x);
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const prioOf = (i) => (i.p >= 1 && i.p <= 5) ? i.p : 3;
  const cap = (s) => s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);

  const dkey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };

  let seg = 'daily';            // 'daily' | 'todo'
  let activeTodo = 'todo';
  let addPrio = 3;
  let editRid = null;
  let editTid = null;

  // ---------- günlük rutinler ----------
  function streakOf(rid) {
    let n = 0;
    let d = today();
    if (!AppSync.getRChecks(dkey(d))[rid]) d = new Date(d.getTime() - 86400000); // bugün henüz yapılmadıysa dünden say
    while (AppSync.getRChecks(dkey(d))[rid]) { n++; d = new Date(d.getTime() - 86400000); }
    return n;
  }

  function renderDaily() {
    const routines = AppSync.getRoutines();
    const tk = dkey(today());
    const checks = AppSync.getRChecks(tk);
    const ids = Object.keys(routines).sort((a, b) => (routines[a].o || 0) - (routines[b].o || 0) || (routines[a].u || 0) - (routines[b].u || 0));

    const doneCount = ids.filter((r) => checks[r]).length;
    $id('rt-progress').textContent = ids.length
      ? (doneCount === ids.length
          ? 'Bugün hepsi tamam! ' + doneCount + '/' + ids.length + ' 🎉'
          : 'Bugün ' + doneCount + '/' + ids.length + ' tamamlandı')
      : '';

    const host = $id('rt-list');
    if (!ids.length) {
      host.innerHTML = '<p class="mk-empty">Henüz rutin yok — yukarıdan ekleyin. Her sabah tikler sıfırlanır, seriler birikir. 🔁</p>';
      return;
    }

    host.innerHTML = ids.map((rid) => {
      const r = routines[rid];
      const done = !!checks[rid];
      const st = streakOf(rid);
      // son 7 gün noktaları (bugün en sağda)
      let dots = '';
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today().getTime() - i * 86400000);
        const on = !!AppSync.getRChecks(dkey(d))[rid];
        dots += '<span class="rt-dot' + (on ? ' on' : '') + (i === 0 ? ' today' : '') + '"></span>';
      }
      const by = r.by ? '<span class="mk-by mk-by-' + r.by + '">' + r.by + '</span>' : '';
      return '<div class="mk-row rt-row' + (done ? ' rt-done' : '') + '" data-r="' + rid + '">' +
        '<button class="mk-check rt-check" data-r="' + rid + '">' + (done ? '✓' : '') + '</button>' +
        '<div class="mk-body"><div class="mk-name">' + esc(r.n) + '</div><div class="rt-dots">' + dots + '</div></div>' +
        (st > 1 ? '<span class="rt-streak">🔥' + st + '</span>' : '') + by + '</div>';
    }).join('');

    host.querySelectorAll('.rt-check').forEach((c) => c.addEventListener('click', (e) => {
      e.stopPropagation();
      const rid = c.dataset.r;
      AppSync.setRCheck(tk, rid, !AppSync.getRChecks(tk)[rid]);
    }));
    host.querySelectorAll('.rt-row').forEach((row) => row.addEventListener('click', () => openRoutineEditor(row.dataset.r)));
  }

  function addRoutine(name) {
    name = (name || '').trim();
    if (!name) return;
    const rid = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    AppSync.saveRoutine(rid, { n: cap(name), by: AppSync.who(), o: Object.keys(AppSync.getRoutines()).length, u: Date.now() });
  }

  function openRoutineEditor(rid) {
    const r = AppSync.getRoutines()[rid];
    if (!r) return;
    editRid = rid;
    $id('rte-name').value = r.n;
    $id('rtedit-modal').classList.remove('hidden');
  }

  // ---------- yapılacak listeleri ----------
  function todoLists() {
    const all = AppSync.getLists();
    const out = {};
    for (const id in all) if (all[id].kind === 'todo') out[id] = all[id];
    return out;
  }

  function renderTodoTabs() {
    const lists = todoLists();
    if (!lists[activeTodo]) activeTodo = Object.keys(lists)[0] || 'todo';
    const wrap = $id('td-tabs');
    wrap.innerHTML = Object.keys(lists).sort((a, b) => (lists[a].o || 0) - (lists[b].o || 0)).map((id) => {
      const cnt = Object.values(AppSync.getItems(id)).filter((i) => !i.done).length;
      return '<button class="mk-tab' + (id === activeTodo ? ' on' : '') + '" data-l="' + id + '">' +
        lists[id].icon + ' ' + esc(lists[id].name) + (cnt ? ' <span class="mk-cnt">' + cnt + '</span>' : '') + '</button>';
    }).join('') + '<button class="mk-tab mk-tab-add" id="td-add-list">＋</button>';

    wrap.querySelectorAll('.mk-tab[data-l]').forEach((b) => {
      b.addEventListener('click', () => { activeTodo = b.dataset.l; render(); });
      let t;
      b.addEventListener('touchstart', () => { t = setTimeout(() => askDeleteTodoList(b.dataset.l), 700); }, { passive: true });
      b.addEventListener('touchend', () => clearTimeout(t), { passive: true });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); askDeleteTodoList(b.dataset.l); });
    });
    $id('td-add-list').addEventListener('click', () => {
      const name = prompt('Yeni liste adı (ör. Ev Temizliği):');
      if (name && name.trim()) {
        activeTodo = AppSync.createList(cap(name.trim()), '📌', 'todo');
        render();
      }
    });
  }

  function askDeleteTodoList(id) {
    if (id === 'todo') return;   // varsayılan silinmez
    const lists = todoLists();
    if (!lists[id]) return;
    if (confirm('"' + lists[id].name + '" listesi ve içindekiler silinsin mi?')) {
      AppSync.deleteList(id);
      activeTodo = 'todo';
      render();
    }
  }

  function renderTodoItems() {
    const items = AppSync.getItems(activeTodo);
    const open = [], done = [];
    for (const id in items) (items[id].done ? done : open).push({ id, ...items[id] });
    open.sort((a, b) => prioOf(b) - prioOf(a) || (a.u || 0) - (b.u || 0));
    done.sort((a, b) => (b.u || 0) - (a.u || 0));

    const row = (i) => {
      const p = prioOf(i);
      const stars = (!i.done && p !== 3) ? '<span class="mk-stars mk-stars-' + p + '">' + '★'.repeat(p) + '</span>' : '';
      const by = i.by ? '<span class="mk-by mk-by-' + i.by + '">' + i.by + '</span>' : '';
      return '<div class="mk-row' + (i.done ? ' mk-done' : '') + '" data-i="' + i.id + '">' +
        '<button class="mk-check" data-i="' + i.id + '">' + (i.done ? '✓' : '') + '</button>' +
        '<div class="mk-body"><div class="mk-name">' + esc(i.n) + ' ' + stars + '</div></div>' + by + '</div>';
    };

    let html = open.map(row).join('');
    if (!open.length) html += '<p class="mk-empty">Liste boş — aklına geleni yaz, tikleyerek ilerleyin. 📌</p>';
    if (done.length) {
      html += '<div class="mk-done-head"><span>Tamamlananlar (' + done.length + ')</span><button id="td-clear" class="mk-clear">Temizle</button></div>';
      html += done.map(row).join('');
    }
    const host = $id('td-items');
    host.innerHTML = html;

    host.querySelectorAll('.mk-check').forEach((c) => c.addEventListener('click', (e) => {
      e.stopPropagation();
      const it = items[c.dataset.i];
      it.done = !it.done; it.u = Date.now();
      AppSync.saveItem(activeTodo, c.dataset.i, it);
    }));
    host.querySelectorAll('.mk-row[data-i]').forEach((r) => r.addEventListener('click', () => openTodoEditor(r.dataset.i)));
    const clr = $id('td-clear');
    if (clr) clr.addEventListener('click', (e) => {
      e.stopPropagation();
      for (const id in items) if (items[id].done) AppSync.deleteItem(activeTodo, id);
    });
  }

  function addTodo(name) {
    name = (name || '').trim();
    if (!name) return;
    const id = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    AppSync.saveItem(activeTodo, id, { n: cap(name), p: addPrio, by: AppSync.who(), done: false, u: Date.now() });
  }

  function openTodoEditor(id) {
    const it = AppSync.getItems(activeTodo)[id];
    if (!it) return;
    editTid = id;
    $id('tde-name').value = it.n;
    const p = prioOf(it);
    $id('tde-prio').innerHTML = [5, 4, 3, 2, 1].map((v) =>
      '<button class="chip' + (v === p ? ' on' : '') + '" data-p="' + v + '">' + '★'.repeat(v) + ' ' + PRIO_LABEL[v] + '</button>').join('');
    $id('tde-prio').querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      $id('tde-prio').querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b));
    }));
    $id('tdedit-modal').classList.remove('hidden');
  }

  // ---------- render ----------
  function render() {
    document.querySelectorAll('#rt-seg .mk-seg-btn').forEach((b) => b.classList.toggle('on', b.dataset.rt === seg));
    $id('rt-daily').classList.toggle('hidden', seg !== 'daily');
    $id('rt-todo').classList.toggle('hidden', seg !== 'todo');
    if (seg === 'daily') renderDaily();
    else { renderTodoTabs(); renderTodoItems(); }
  }

  function renderPrioBtn() {
    const b = $id('td-prio-btn');
    b.textContent = '★' + addPrio;
    b.className = 'mk-prio-btn mk-prio-' + addPrio;
  }

  function init() {
    document.querySelectorAll('#rt-seg .mk-seg-btn').forEach((b) => b.addEventListener('click', () => { seg = b.dataset.rt; render(); }));

    $id('rt-add-btn').addEventListener('click', () => { addRoutine($id('rt-input').value); $id('rt-input').value = ''; });
    $id('rt-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { addRoutine(e.target.value); e.target.value = ''; } });

    $id('td-add-btn').addEventListener('click', () => { addTodo($id('td-input').value); $id('td-input').value = ''; addPrio = 3; renderPrioBtn(); });
    $id('td-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { addTodo(e.target.value); e.target.value = ''; addPrio = 3; renderPrioBtn(); } });
    $id('td-prio-btn').addEventListener('click', () => { addPrio = addPrio >= 5 ? 1 : addPrio + 1; renderPrioBtn(); });

    $id('rte-save').addEventListener('click', () => {
      const r = AppSync.getRoutines()[editRid];
      if (r) { r.n = $id('rte-name').value.trim() || r.n; AppSync.saveRoutine(editRid, r); }
      $id('rtedit-modal').classList.add('hidden');
    });
    $id('rte-delete').addEventListener('click', () => {
      if (confirm('Bu rutin ve tüm seri geçmişi silinsin mi?')) { AppSync.deleteRoutine(editRid); $id('rtedit-modal').classList.add('hidden'); }
    });
    $id('rte-close').addEventListener('click', () => $id('rtedit-modal').classList.add('hidden'));

    $id('tde-save').addEventListener('click', () => {
      const it = AppSync.getItems(activeTodo)[editTid];
      if (it) {
        it.n = $id('tde-name').value.trim() || it.n;
        const sel = $id('tde-prio').querySelector('.chip.on');
        it.p = sel ? +sel.dataset.p : prioOf(it);
        it.u = Date.now();
        AppSync.saveItem(activeTodo, editTid, it);
      }
      $id('tdedit-modal').classList.add('hidden');
    });
    $id('tde-delete').addEventListener('click', () => { AppSync.deleteItem(activeTodo, editTid); $id('tdedit-modal').classList.add('hidden'); });
    $id('tde-close').addEventListener('click', () => $id('tdedit-modal').classList.add('hidden'));

    AppSync.on('routine', render);
    AppSync.on('market', () => { if (seg === 'todo') render(); });
    render();
    renderPrioBtn();
  }

  window.Routines = { init, render };
  init();
})();
