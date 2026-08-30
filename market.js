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

  function guessCat(name) {
    const n = ' ' + name.toLowerCase().trim() + ' ';
    for (const cat in DICT)
      for (const w of DICT[cat])
        if (n.includes(w.trim())) return cat;
    return 'ev';
  }

  const catOf = (id) => CATS.find((c) => c.id === id) || CATS[CATS.length - 2];

  // ---------- sık alınanlar ----------
  function bumpHist(name) {
    const meta = AppSync.getMeta();
    const hist = meta.hist || {};
    const k = name.toLowerCase().trim();
    hist[k] = (hist[k] || 0) + 1;
    // şişmesin: en sık 60 kayıt
    const keys = Object.keys(hist).sort((a, b) => hist[b] - hist[a]).slice(0, 60);
    const trimmed = {};
    keys.forEach((x) => trimmed[x] = hist[x]);
    AppSync.saveMeta({ hist: trimmed });
  }

  function suggestions() {
    const hist = AppSync.getMeta().hist || {};
    const inList = new Set(Object.values(AppSync.getItems(activeList)).filter((i) => !i.done).map((i) => i.n.toLowerCase().trim()));
    return Object.keys(hist)
      .sort((a, b) => hist[b] - hist[a])
      .filter((k) => !inList.has(k))
      .slice(0, 10);
  }

  // ---------- listeler ----------
  function renderTabs() {
    const lists = AppSync.getLists();
    if (!lists[activeList]) activeList = Object.keys(lists)[0] || 'market';
    const wrap = $id('mk-tabs');
    const items = AppSync.getItems.bind(AppSync);
    wrap.innerHTML = Object.keys(lists).sort((a, b) => (lists[a].o || 0) - (lists[b].o || 0)).map((id) => {
      const cnt = Object.values(items(id)).filter((i) => !i.done).length;
      return '<button class="mk-tab' + (id === activeList ? ' on' : '') + '" data-l="' + id + '">' +
        lists[id].icon + ' ' + lists[id].name + (cnt ? ' <span class="mk-cnt">' + cnt + '</span>' : '') + '</button>';
    }).join('') + '<button class="mk-tab mk-tab-add" id="mk-add-list">＋</button>';

    wrap.querySelectorAll('.mk-tab[data-l]').forEach((b) => {
      b.addEventListener('click', () => { activeList = b.dataset.l; render(); });
      // uzun basınca liste sil (varsayılan market hariç)
      let t;
      b.addEventListener('touchstart', () => { t = setTimeout(() => askDeleteList(b.dataset.l), 700); }, { passive: true });
      b.addEventListener('touchend', () => clearTimeout(t), { passive: true });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); askDeleteList(b.dataset.l); });
    });
    $id('mk-add-list').addEventListener('click', () => $id('mklist-modal').classList.remove('hidden'));
  }

  function askDeleteList(id) {
    const lists = AppSync.getLists();
    if (Object.keys(lists).length <= 1) return;
    if (confirm('"' + lists[id].name + '" listesi silinsin mi?')) {
      AppSync.deleteList(id);
      activeList = Object.keys(AppSync.getLists())[0];
      render();
    }
  }

  // ---------- ürünler ----------
  function renderItems() {
    const items = AppSync.getItems(activeList);
    const open = [], done = [];
    for (const id in items) (items[id].done ? done : open).push({ id, ...items[id] });

    // kategoriye göre grupla
    const byCat = {};
    open.forEach((i) => { (byCat[i.c || 'ev'] = byCat[i.c || 'ev'] || []).push(i); });

    const host = $id('mk-items');
    let html = '';
    for (const cat of CATS) {
      const arr = byCat[cat.id];
      if (!arr) continue;
      arr.sort((a, b) => (a.u || 0) - (b.u || 0));
      html += '<div class="mk-cat">' + cat.icon + ' ' + cat.name + '</div>';
      html += arr.map(row).join('');
    }
    if (!open.length) html += '<p class="mk-empty">Liste boş — yukarıdan ekleyin. 🛒</p>';

    if (done.length) {
      done.sort((a, b) => (b.u || 0) - (a.u || 0));
      html += '<div class="mk-done-head"><span>Alınanlar (' + done.length + ')</span><button id="mk-clear" class="mk-clear">Temizle</button></div>';
      html += done.map(row).join('');
    }
    host.innerHTML = html;

    host.querySelectorAll('.mk-check').forEach((c) => c.addEventListener('click', (e) => {
      e.stopPropagation();
      const it = items[c.dataset.i];
      it.done = !it.done; it.u = Date.now();
      AppSync.saveItem(activeList, c.dataset.i, it);
    }));
    host.querySelectorAll('.mk-row').forEach((r) => r.addEventListener('click', () => openItemEditor(r.dataset.i)));
    const clr = $id('mk-clear');
    if (clr) clr.addEventListener('click', (e) => {
      e.stopPropagation();
      for (const id in items) if (items[id].done) AppSync.deleteItem(activeList, id);
    });
  }

  function row(i) {
    const cat = catOf(i.c);
    const qty = i.q ? '<span class="mk-qty">' + i.q + '</span>' : '';
    const note = i.note ? '<div class="mk-note">' + esc(i.note) + '</div>' : '';
    const by = i.by ? '<span class="mk-by mk-by-' + i.by + '">' + i.by + '</span>' : '';
    return '<div class="mk-row' + (i.done ? ' mk-done' : '') + '" data-i="' + i.id + '">' +
      '<button class="mk-check" data-i="' + i.id + '">' + (i.done ? '✓' : '') + '</button>' +
      '<div class="mk-body"><div class="mk-name">' + esc(i.n) + ' ' + qty + '</div>' + note + '</div>' +
      by + '<span class="mk-caticon">' + cat.icon + '</span></div>';
  }

  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  function renderSuggestions() {
    const sug = suggestions();
    const host = $id('mk-suggest');
    host.innerHTML = sug.map((s) => '<button class="chip chip-sm" data-s="' + esc(s) + '">＋ ' + esc(s) + '</button>').join('');
    host.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => addItem(b.dataset.s)));
  }

  function addItem(name, qty) {
    name = (name || '').trim();
    if (!name) return;
    const id = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    AppSync.saveItem(activeList, id, {
      n: name.charAt(0).toUpperCase() + name.slice(1),
      q: qty || '', note: '', c: guessCat(name),
      by: AppSync.who(), done: false, u: Date.now()
    });
    bumpHist(name);
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
    it.u = Date.now();
    AppSync.saveItem(activeList, editItemId, it);
    $id('mkitem-modal').classList.add('hidden');
  }

  // ---------- ana render ----------
  function render() {
    renderTabs();
    renderItems();
    renderSuggestions();
  }

  function init() {
    $id('mk-add-btn').addEventListener('click', () => {
      addItem($id('mk-input').value, $id('mk-qty-input').value);
      $id('mk-input').value = ''; $id('mk-qty-input').value = '';
      $id('mk-input').focus();
    });
    $id('mk-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { addItem(e.target.value, $id('mk-qty-input').value); e.target.value = ''; $id('mk-qty-input').value = ''; }
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
