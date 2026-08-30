/* ============ Ortak alışveriş listesi 🛒 ============ */

(function () {
  'use strict';

  const CATS = [
    { id: 'sebze',   name: 'Meyve & Sebze',    icon: '🍎' },
    { id: 'et',      name: 'Et & Tavuk & Balık', icon: '🥩' },
    { id: 'sut',     name: 'Süt & Kahvaltılık', icon: '🧀' },
    { id: 'firin',   name: 'Ekmek & Fırın',    icon: '🥖' },
    { id: 'temel',   name: 'Temel Gıda',       icon: '🍚' },
    { id: 'atistir', name: 'Atıştırmalık & Tatlı', icon: '🍫' },
    { id: 'icecek',  name: 'İçecek',           icon: '🧃' },
    { id: 'temizlik', name: 'Temizlik',        icon: '🧴' },
    { id: 'bakim',   name: 'Kişisel Bakım',    icon: '🧻' },
    { id: 'ev',      name: 'Ev & Diğer',       icon: '🏠' },
    { id: 'truf',    name: 'Trüf',             icon: '🐈' }
  ];

  const PRIO_LABEL = { 5: 'Çok acil', 4: 'Acil', 3: 'Normal', 2: 'Acele yok', 1: 'Belki' };

  // otomatik kategori sözlüğü
  const DICT = {
    sebze: ['domates', 'salatalık', 'biber', 'patates', 'soğan', 'sarımsak', 'limon', 'elma', 'muz', 'portakal', 'mandalina', 'çilek', 'karpuz', 'kavun', 'üzüm', 'marul', 'maydanoz', 'roka', 'ıspanak', 'kabak', 'patlıcan', 'havuç', 'brokoli', 'avokado', 'salata', 'meyve', 'sebze', 'mantar', 'taze fasulye', 'şeftali', 'armut', 'kiraz', 'nar'],
    et: ['kıyma', 'tavuk', 'et ', 'biftek', 'balık', 'somon', 'levrek', 'çipura', 'köfte', 'sucuk', 'salam', 'sosis', 'pastırma', 'hindi', 'antrikot', 'bonfile', 'kuşbaşı', 'pirzola', 'kanat'],
    sut: ['süt', 'yoğurt', 'peynir', 'kaşar', 'lor', 'ayran', 'kefir', 'tereyağı', 'yumurta', 'krema', 'labne', 'zeytin', 'bal ', 'reçel', 'kaymak', 'fındık ezmesi', 'fıstık ezmesi'],
    firin: ['ekmek', 'lavaş', 'bazlama', 'simit', 'poğaça', 'açma', 'tortilla', 'hamburger ekmeği', 'tost ekmeği', 'kruvasan', 'baget'],
    temel: ['makarna', 'pirinç', 'bulgur', 'mercimek', 'nohut', 'fasulye', 'un ', 'şeker', 'tuz', 'salça', 'yağ', 'zeytinyağı', 'ayçiçek', 'sirke', 'baharat', 'karabiber', 'pul biber', 'kekik', 'nane', 'çorba', 'konserve', 'ton balığı', 'mısır', 'erişte', 'spagetti', 'soya sosu', 'ketçap', 'mayonez', 'hardal'],
    atistir: ['çikolata', 'gofret', 'bisküvi', 'kek', 'cips', 'kraker', 'kuruyemiş', 'fındık', 'fıstık', 'badem', 'ceviz', 'dondurma', 'tatlı', 'lokum', 'jelibon', 'kurabiye', 'çerez', 'sütlaç', 'boston'],
    icecek: ['su ', 'maden suyu', 'soda', 'kola', 'gazoz', 'meyve suyu', 'çay', 'kahve', 'limonata', 'ayran', 'ice tea', 'smoothie', 'süt '],
    temizlik: ['deterjan', 'yumuşatıcı', 'bulaşık', 'çamaşır suyu', 'yüzey temizleyici', 'cam sil', 'sünger', 'çöp poşeti', 'temizlik bezi', 'kağıt havlu', 'ıslak mendil', 'sabun', 'domestos', 'cif', 'fairy'],
    bakim: ['şampuan', 'saç kremi', 'duş jeli', 'diş macunu', 'diş fırçası', 'deodorant', 'parfüm', 'krem', 'ped', 'tampon', 'makyaj', 'tıraş', 'losyon', 'güneş kremi', 'ruj', 'maskara', 'tuvalet kağıdı'],
    truf: ['mama', 'kedi', 'kum ', 'ödül maması', 'kedi kumu', 'kedi maması', 'oyuncak']
  };

  const $id = (x) => document.getElementById(x);
  let activeList = 'market';
  let addPrio = 3;                                       // ekleme çubuğundaki seçili öncelik
  let histOpen = false;

  function guessCat(name) {
    const n = ' ' + name.toLowerCase().trim() + ' ';
    for (const cat in DICT)
      for (const w of DICT[cat])
        if (n.includes(w.trim())) return cat;
    return 'ev';
  }

  const catOf = (id) => CATS.find((c) => c.id === id) || CATS[CATS.length - 2];
  const prioOf = (i) => (i.p >= 1 && i.p <= 5) ? i.p : 3;

  // ---------- geçmiş (liste bazlı, kalıcı) ----------
  function getHist() {
    const meta = AppSync.getMeta();
    const h2 = meta.hist2 || {};
    // eski düz geçmişi bir defalık taşı
    if (meta.hist && !meta.histMigrated) {
      h2.market = h2.market || {};
      for (const k in meta.hist) {
        if (!h2.market[k]) h2.market[k] = { n: k.charAt(0).toLocaleUpperCase('tr-TR') + k.slice(1), c: meta.hist[k], cat: guessCat(k), p: 3, u: 0 };
      }
      AppSync.saveMeta({ hist2: h2, histMigrated: true });
    }
    return h2;
  }

  function bumpHist(listId, item) {
    const h2 = getHist();
    const k = item.n.toLowerCase().trim();
    const l = h2[listId] = h2[listId] || {};
    const old = l[k] || { c: 0 };
    l[k] = { n: item.n, c: old.c + 1, cat: item.c, p: prioOf(item), u: Date.now() };
    // şişmesin: liste başına en yeni/en sık 100 kayıt
    const keys = Object.keys(l).sort((a, b) => (l[b].u || 0) - (l[a].u || 0)).slice(0, 100);
    const trimmed = {};
    keys.forEach((x) => trimmed[x] = l[x]);
    h2[listId] = trimmed;
    AppSync.saveMeta({ hist2: h2 });
  }

  function removeFromHist(listId, key) {
    const h2 = getHist();
    if (h2[listId]) { delete h2[listId][key]; AppSync.saveMeta({ hist2: h2 }); }
  }

  function openNames() {
    return new Set(Object.values(AppSync.getItems(activeList)).filter((i) => !i.done).map((i) => i.n.toLowerCase().trim()));
  }

  function suggestions() {
    const l = getHist()[activeList] || {};
    const inList = openNames();
    return Object.keys(l)
      .sort((a, b) => (l[b].c || 0) - (l[a].c || 0))
      .filter((k) => !inList.has(k))
      .slice(0, 10)
      .map((k) => l[k]);
  }

  // ---------- listeler ----------
  function renderTabs() {
    const lists = AppSync.getLists();
    if (!lists[activeList]) activeList = Object.keys(lists)[0] || 'market';
    const wrap = $id('mk-tabs');
    wrap.innerHTML = Object.keys(lists).sort((a, b) => (lists[a].o || 0) - (lists[b].o || 0)).map((id) => {
      const cnt = Object.values(AppSync.getItems(id)).filter((i) => !i.done).length;
      return '<button class="mk-tab' + (id === activeList ? ' on' : '') + '" data-l="' + id + '">' +
        lists[id].icon + ' ' + esc(lists[id].name) + (cnt ? ' <span class="mk-cnt">' + cnt + '</span>' : '') + '</button>';
    }).join('') + '<button class="mk-tab mk-tab-add" id="mk-add-list">＋</button>';

    wrap.querySelectorAll('.mk-tab[data-l]').forEach((b) => {
      b.addEventListener('click', () => { activeList = b.dataset.l; histOpen = false; render(); });
      let t;
      b.addEventListener('touchstart', () => { t = setTimeout(() => askDeleteList(b.dataset.l), 700); }, { passive: true });
      b.addEventListener('touchend', () => clearTimeout(t), { passive: true });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); askDeleteList(b.dataset.l); });
    });
    $id('mk-add-list').addEventListener('click', () => $id('mklist-modal').classList.remove('hidden'));
  }

  function askDeleteList(id) {
    const lists = AppSync.getLists();
    if (id === 'market' || id === 'online') return;   // varsayılanlar silinmez
    if (Object.keys(lists).length <= 1) return;
    if (confirm('"' + lists[id].name + '" listesi silinsin mi?')) {
      AppSync.deleteList(id);
      activeList = 'market';
      render();
    }
  }

  // ---------- ürünler ----------
  function renderItems() {
    const items = AppSync.getItems(activeList);
    const open = [], done = [];
    for (const id in items) (items[id].done ? done : open).push({ id, ...items[id] });

    const host = $id('mk-items');
    let html = '';

    // düz liste: acil olan üstte, sonra eklenme sırası
    open.sort((a, b) => prioOf(b) - prioOf(a) || (a.u || 0) - (b.u || 0));
    html += open.map((i) => row(i, false)).join('');
    if (!open.length) html += '<p class="mk-empty">Liste boş — yukarıdan ekleyin. 🛒</p>';

    // alınanlar
    if (done.length) {
      done.sort((a, b) => (b.u || 0) - (a.u || 0));
      html += '<div class="mk-done-head"><span>Alınanlar (' + done.length + ')</span><button id="mk-clear" class="mk-clear">Geçmişe kaldır</button></div>';
      html += done.map((i) => row(i, false)).join('');
    }

    // geçmiş
    const l = getHist()[activeList] || {};
    const inList = openNames();
    const histKeys = Object.keys(l).filter((k) => !inList.has(k)).sort((a, b) => (l[b].u || 0) - (l[a].u || 0));
    if (histKeys.length) {
      html += '<div class="mk-done-head mk-hist-head" id="mk-hist-toggle"><span>' + (histOpen ? '▾' : '▸') + ' Geçmiş (' + histKeys.length + ')</span><span class="mk-hist-hint">dokun, geri ekle</span></div>';
      if (histOpen) {
        html += histKeys.map((k) => {
          const h = l[k];
          return '<div class="mk-row mk-hist-row" data-h="' + esc(k) + '">' +
            '<button class="mk-check mk-readd" data-h="' + esc(k) + '">↺</button>' +
            '<div class="mk-body"><div class="mk-name">' + esc(h.n) + '</div>' +
            (h.c > 1 ? '<div class="mk-note">' + h.c + ' kez alındı</div>' : '') + '</div>' +
            '<span class="mk-caticon">' + catOf(h.cat).icon + '</span>' +
            '<button class="mk-hist-del" data-h="' + esc(k) + '">✕</button></div>';
        }).join('');
      }
    }
    host.innerHTML = html;

    // olaylar
    host.querySelectorAll('.mk-check:not(.mk-readd)').forEach((c) => c.addEventListener('click', (e) => {
      e.stopPropagation();
      const it = items[c.dataset.i];
      it.done = !it.done; it.u = Date.now();
      AppSync.saveItem(activeList, c.dataset.i, it);
    }));
    host.querySelectorAll('.mk-row[data-i]').forEach((r) => r.addEventListener('click', () => openItemEditor(r.dataset.i)));
    const clr = $id('mk-clear');
    if (clr) clr.addEventListener('click', (e) => {
      e.stopPropagation();
      for (const id in items) if (items[id].done) {
        bumpHist(activeList, items[id]);
        AppSync.deleteItem(activeList, id);
      }
    });
    const ht = $id('mk-hist-toggle');
    if (ht) ht.addEventListener('click', () => { histOpen = !histOpen; render(); });
    host.querySelectorAll('.mk-readd').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const h = (getHist()[activeList] || {})[b.dataset.h];
      if (h) addItem(h.n, '', h.cat, h.p);
    }));
    host.querySelectorAll('.mk-hist-del').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromHist(activeList, b.dataset.h);
      render();
    }));
  }

  function row(i, inPrioView) {
    const cat = catOf(i.c);
    const p = prioOf(i);
    const qty = i.q ? '<span class="mk-qty">' + esc(i.q) + '</span>' : '';
    const stars = (!inPrioView && p !== 3)
      ? '<span class="mk-stars mk-stars-' + p + '">' + '★'.repeat(p) + '</span>' : '';
    const note = i.note ? '<div class="mk-note">' + esc(i.note) + '</div>' : '';
    const by = i.by ? '<span class="mk-by mk-by-' + i.by + '">' + i.by + '</span>' : '';
    return '<div class="mk-row' + (i.done ? ' mk-done' : '') + '" data-i="' + i.id + '">' +
      '<button class="mk-check" data-i="' + i.id + '">' + (i.done ? '✓' : '') + '</button>' +
      '<div class="mk-body"><div class="mk-name">' + esc(i.n) + ' ' + qty + ' ' + stars + '</div>' + note + '</div>' +
      by + '<span class="mk-caticon">' + cat.icon + '</span></div>';
  }

  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  function renderSuggestions() {
    const sug = suggestions();
    const host = $id('mk-suggest');
    host.innerHTML = sug.map((h) => '<button class="chip chip-sm" data-s="' + esc(h.n.toLowerCase().trim()) + '">＋ ' + esc(h.n) + '</button>').join('');
    host.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      const h = (getHist()[activeList] || {})[b.dataset.s];
      if (h) addItem(h.n, '', h.cat, h.p);
    }));
  }

  function addItem(name, qty, cat, prio) {
    name = (name || '').trim();
    if (!name) return;
    const id = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const item = {
      n: name.charAt(0).toLocaleUpperCase('tr-TR') + name.slice(1),
      q: qty || '', note: '',
      c: cat || guessCat(name),
      p: prio || addPrio,
      by: AppSync.who(), done: false, u: Date.now()
    };
    AppSync.saveItem(activeList, id, item);
    bumpHist(activeList, item);
  }

  // ---------- öncelik düğmesi (ekleme çubuğu) ----------
  function renderPrioBtn() {
    const b = $id('mk-prio-btn');
    b.textContent = '★' + addPrio;
    b.className = 'mk-prio-btn mk-prio-' + addPrio;
    b.title = 'Öncelik: ' + PRIO_LABEL[addPrio];
  }

  // ---------- ürün düzenleme ----------
  let editItemId = null;
  function openItemEditor(id) {
    const it = AppSync.getItems(activeList)[id];
    if (!it) return;
    editItemId = id;
    $id('mki-name').value = it.n;
    $id('mki-qty').value = it.q || '';
    $id('mki-note').value = it.note || '';
    $id('mki-cat').innerHTML = CATS.map((c) =>
      '<option value="' + c.id + '"' + ((it.c || 'ev') === c.id ? ' selected' : '') + '>' + c.icon + ' ' + c.name + '</option>').join('');

    const lists = AppSync.getLists();
    $id('mki-list').innerHTML = Object.keys(lists).sort((a, b) => (lists[a].o || 0) - (lists[b].o || 0)).map((lid) =>
      '<option value="' + lid + '"' + (lid === activeList ? ' selected' : '') + '>' + lists[lid].icon + ' ' + esc(lists[lid].name) + '</option>').join('');

    const p = prioOf(it);
    $id('mki-prio').innerHTML = [5, 4, 3, 2, 1].map((v) =>
      '<button class="chip' + (v === p ? ' on' : '') + '" data-p="' + v + '">' + '★'.repeat(v) + ' ' + PRIO_LABEL[v] + '</button>').join('');
    $id('mki-prio').querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      $id('mki-prio').querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b));
    }));

    $id('mkitem-modal').classList.remove('hidden');
  }

  function saveItemEditor() {
    const items = AppSync.getItems(activeList);
    const it = items[editItemId];
    if (!it) return;
    it.n = $id('mki-name').value.trim() || it.n;
    it.q = $id('mki-qty').value.trim();
    it.note = $id('mki-note').value.trim();
    it.c = $id('mki-cat').value;
    const sel = $id('mki-prio').querySelector('.chip.on');
    it.p = sel ? +sel.dataset.p : prioOf(it);
    it.u = Date.now();

    const targetList = $id('mki-list').value;
    if (targetList !== activeList) {
      AppSync.deleteItem(activeList, editItemId);
      AppSync.saveItem(targetList, editItemId, it);
    } else {
      AppSync.saveItem(activeList, editItemId, it);
    }
    $id('mkitem-modal').classList.add('hidden');
  }

  // ---------- ana render ----------
  function render() {
    renderTabs();
    renderItems();
    renderSuggestions();
    renderPrioBtn();
  }

  function init() {
    $id('mk-add-btn').addEventListener('click', () => {
      addItem($id('mk-input').value, $id('mk-qty-input').value);
      $id('mk-input').value = ''; $id('mk-qty-input').value = '';
      addPrio = 3; renderPrioBtn();
      $id('mk-input').focus();
    });
    $id('mk-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        addItem(e.target.value, $id('mk-qty-input').value);
        e.target.value = ''; $id('mk-qty-input').value = '';
        addPrio = 3; renderPrioBtn();
      }
    });
    $id('mk-prio-btn').addEventListener('click', () => {
      addPrio = addPrio >= 5 ? 1 : addPrio + 1;
      renderPrioBtn();
    });

    $id('mki-save').addEventListener('click', saveItemEditor);
    $id('mki-delete').addEventListener('click', () => { AppSync.deleteItem(activeList, editItemId); $id('mkitem-modal').classList.add('hidden'); });
    $id('mki-close').addEventListener('click', () => $id('mkitem-modal').classList.add('hidden'));

    $id('mklist-save').addEventListener('click', () => {
      const name = $id('mklist-name').value.trim();
      if (name) {
        const icon = $id('mklist-icon').value.trim() || '📝';
        activeList = AppSync.createList(name, icon);
        $id('mklist-name').value = '';
        render();
      }
      $id('mklist-modal').classList.add('hidden');
    });
    $id('mklist-close').addEventListener('click', () => $id('mklist-modal').classList.add('hidden'));

    AppSync.on('market', render);
    render();
  }

  window.Market = { init, render };
  init();
})();
