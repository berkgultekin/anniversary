/* ============ Senkron katmanı ============
   - Sabit eşleşme: uygulamada gömülü ortak alan; ayarlardan sadece
     "Ben Berk / Ben Damla" seçilir, kod-link gerekmez.
   - Şifreleme: tüm içerik cihazda AES-GCM ile şifrelenir; buluta yalnızca
     şifreli veri gider.
   - Veri asla silinmez: bulut ve yerel BİRLEŞTİRİLİR; bağlantı yokken
     yazılanlar kuyruğa alınır, bağlantı gelince gönderilir.               */

(function () {
  'use strict';

  const LS = {
    pair:  's365_pair',      // {id, key(b64url), who: 'B'|'D'}
    cycle: 's365_cycle',     // {'YYYY-MM-DD': {f,s,m,n}}
    lists: 's365_lists',     // {listId: {name, icon, o}}
    items: 's365_items',     // {listId: {itemId: {n,q,note,c,by,done,u}}}
    meta:  's365_meta',      // {cycleLen, periodLen, mu, hist2:{...}}
    queue: 's365_queue',     // bekleyen bulut yazmaları [{t,s,o,u}]
    routines: 's365_routines',   // {rid: {n, by, o, u}}
    rchecks:  's365_rchecks'     // {'YYYY-MM-DD': {rid: true}}
  };

  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  const state = {
    pair: read(LS.pair, null),
    cycle: read(LS.cycle, {}),
    lists: read(LS.lists, {}),
    items: read(LS.items, {}),
    meta: read(LS.meta, {}),
    routines: read(LS.routines, {}),
    rchecks: read(LS.rchecks, {}),
    online: false,
    mode: 'local'
  };
  let queue = read(LS.queue, []);

  // Varsayılan listeler
  if (!state.lists['market']) state.lists['market'] = { name: 'Market alışverişi', icon: '🛒', o: 0 };
  else if (state.lists['market'].name === 'Market') state.lists['market'].name = 'Market alışverişi';
  if (!state.lists['online']) state.lists['online'] = { name: 'Online alışveriş', icon: '💻', o: 1 };
  if (!state.lists['todo']) state.lists['todo'] = { name: 'Yapılacaklar', icon: '✅', o: 90, kind: 'todo' };
  write(LS.lists, state.lists);

  let fs = null;
  let aesKey = null;
  let connecting = false;
  const listeners = { cycle: [], market: [], routine: [], status: [] };

  // ---------- yardımcılar ----------
  const b64u = {
    enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    dec: (s) => {
      s = s.replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      const raw = atob(s);
      const a = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i);
      return a.buffer;
    }
  };

  function emit(kind) {
    (listeners[kind] || []).forEach((fn) => { try { fn(); } catch (e) {} });
  }

  // ---------- sabit eşleşme kimliği ----------
  const FIXED = (() => {
    const OBF = 'LhAsURUCFQ4BbF1iHFMCGREKFUwNGT1KU3tRdTwlRh9UDBIeWX4HBmBZJkBMPyJSQQoFeFRdRVE=';
    const K = 'trufmatik-2026';
    const raw = atob(OBF);
    let plain = '';
    for (let i = 0; i < raw.length; i++) plain += String.fromCharCode(raw.charCodeAt(i) ^ K.charCodeAt(i % K.length));
    const p = plain.split('.');
    return { id: p[0], key: p[1] };
  })();

  // ---------- şifreleme ----------
  async function loadKey() {
    if (!state.pair || aesKey) return;
    aesKey = await crypto.subtle.importKey('raw', b64u.dec(state.pair.key), 'AES-GCM', false, ['encrypt', 'decrypt']);
  }

  async function seal(obj) {
    await loadKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, data);
    const out = new Uint8Array(12 + ct.byteLength);
    out.set(iv, 0); out.set(new Uint8Array(ct), 12);
    return b64u.enc(out.buffer);
  }

  async function open(b64) {
    await loadKey();
    const buf = new Uint8Array(b64u.dec(b64));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, aesKey, buf.slice(12));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  // ---------- bekleyen yazma kuyruğu ----------
  function qpush(op) {
    queue.push(op);
    if (queue.length > 500) queue = queue.slice(-500);
    write(LS.queue, queue);
  }

  async function flushQueue() {
    if (!fs || !queue.length) return;
    const ops = queue.splice(0);
    write(LS.queue, queue);
    for (const op of ops) {
      if (op.t === 'put') await fsPut(op.s, op.o, op.u);
      else await fsDel(op.s);
    }
  }

  // ---------- Firestore ----------
  async function connect() {
    if (!window.FIREBASE_CONFIG || !state.pair) return;
    if (fs) { flushQueue(); return; }
    if (connecting) return;
    connecting = true;
    try {
      const appM = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      const fsM = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const app = appM.initializeApp(window.FIREBASE_CONFIG);
      let db;
      try {
        db = fsM.initializeFirestore(app, {
          localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentSingleTabManager() })
        });
      } catch (e) { db = fsM.getFirestore(app); }
      fs = {
        db,
        doc: fsM.doc, setDoc: fsM.setDoc, deleteDoc: fsM.deleteDoc, getDoc: fsM.getDoc,
        collection: fsM.collection, onSnapshot: fsM.onSnapshot
      };
      state.mode = 'sync';
      subscribe();
      await flushQueue();     // bağlantı yokken birikenler
      await pushAllLocal();   // yereldeki her şeyi bulutla birleştir
      state.online = true;
      emit('status');
    } catch (e) {
      // internet yok / SDK inmedi: yerel modda devam, sonra tekrar dene
      state.online = false;
      emit('status');
      setTimeout(connect, 20000);
    } finally {
      connecting = false;
    }
  }

  // bağlantı fırsatlarında tekrar dene / kuyruğu boşalt
  window.addEventListener('online', () => connect());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) connect(); });

  const P = () => 'pairs/' + ((state.pair && state.pair.id) || '_');

  function subscribe() {
    // Döngü kayıtları
    fs.onSnapshot(fs.collection(fs.db, P() + '/cycle'), async (snap) => {
      let changed = false;
      for (const ch of snap.docChanges()) {
        const id = ch.doc.id;
        if (ch.type === 'removed') { delete state.cycle[id]; changed = true; continue; }
        try {
          const v = await open(ch.doc.data().e);
          state.cycle[id] = v; changed = true;
        } catch (e) {}
      }
      if (changed) { write(LS.cycle, state.cycle); emit('cycle'); }
      state.online = true; emit('status');
    }, () => {});

    // Listeler
    fs.onSnapshot(fs.collection(fs.db, P() + '/lists'), async (snap) => {
      let changed = false;
      for (const ch of snap.docChanges()) {
        const id = ch.doc.id;
        if (ch.type === 'removed') { delete state.lists[id]; delete state.items[id]; changed = true; continue; }
        try { state.lists[id] = await open(ch.doc.data().e); changed = true; } catch (e) {}
      }
      if (changed) { write(LS.lists, state.lists); write(LS.items, state.items); emit('market'); emit('routine'); }
    }, () => {});

    // Ürünler
    fs.onSnapshot(fs.collection(fs.db, P() + '/items'), async (snap) => {
      let changed = false;
      for (const ch of snap.docChanges()) {
        const id = ch.doc.id;
        if (ch.type === 'removed') {
          for (const lid in state.items) if (state.items[lid][id]) { delete state.items[lid][id]; changed = true; }
          continue;
        }
        try {
          const v = await open(ch.doc.data().e);
          const lid = v.list || 'market';
          if (!state.items[lid]) state.items[lid] = {};
          state.items[lid][id] = v; changed = true;
        } catch (e) {}
      }
      if (changed) { write(LS.items, state.items); emit('market'); emit('routine'); }
    }, () => {});

    // Rutinler
    fs.onSnapshot(fs.collection(fs.db, P() + '/routines'), async (snap) => {
      let changed = false;
      for (const ch of snap.docChanges()) {
        const id = ch.doc.id;
        if (ch.type === 'removed') { delete state.routines[id]; changed = true; continue; }
        try { state.routines[id] = await open(ch.doc.data().e); changed = true; } catch (e) {}
      }
      if (changed) { write(LS.routines, state.routines); emit('routine'); }
    }, () => {});

    // Rutin tikleri (gün başına doküman: 'YYYY-MM-DD_rid')
    fs.onSnapshot(fs.collection(fs.db, P() + '/rchecks'), (snap) => {
      let changed = false;
      for (const ch of snap.docChanges()) {
        const id = ch.doc.id;
        const date = id.slice(0, 10), rid = id.slice(11);
        if (!date || !rid) continue;
        if (ch.type === 'removed') {
          if (state.rchecks[date]) { delete state.rchecks[date][rid]; changed = true; }
        } else {
          (state.rchecks[date] = state.rchecks[date] || {})[rid] = true; changed = true;
        }
      }
      if (changed) { write(LS.rchecks, state.rchecks); emit('routine'); }
    }, () => {});

    // Ayarlar — zaman damgası yenisi kazanır, eski asla yeniyi ezmez
    fs.onSnapshot(fs.doc(fs.db, P() + '/meta/settings'), async (snap) => {
      if (!snap.exists()) return;
      try {
        const m = await open(snap.data().e);
        const cloudT = m.mu || snap.data().u || 0;
        const localT = state.meta.mu || 0;
        if (cloudT >= localT) {
          state.meta = m;
          write(LS.meta, state.meta); emit('cycle'); emit('market');
        } else {
          fsPut('meta/settings', state.meta, state.meta.mu);
        }
      } catch (e) {}
    }, () => {});
  }

  async function fsPut(sub, obj, ts) {
    if (!fs) { qpush({ t: 'put', s: sub, o: obj, u: ts || Date.now() }); return; }
    try {
      await fs.setDoc(fs.doc(fs.db, P() + '/' + sub), { e: await seal(obj), u: ts || Date.now() });
    } catch (e) {
      qpush({ t: 'put', s: sub, o: obj, u: ts || Date.now() });
    }
  }

  async function fsDel(sub) {
    if (!fs) { qpush({ t: 'del', s: sub }); return; }
    try { await fs.deleteDoc(fs.doc(fs.db, P() + '/' + sub)); } catch (e) { qpush({ t: 'del', s: sub }); }
  }

  async function pushAllLocal() {
    for (const k in state.cycle) await fsPut('cycle/' + k, state.cycle[k]);
    for (const k in state.lists) await fsPut('lists/' + k, state.lists[k]);
    for (const lid in state.items)
      for (const iid in state.items[lid]) await fsPut('items/' + iid, state.items[lid][iid]);
    for (const rid in state.routines) await fsPut('routines/' + rid, state.routines[rid]);
    for (const d in state.rchecks)
      for (const rid in state.rchecks[d]) await fsPut('rchecks/' + d + '_' + rid, { v: 1 });

    // meta: buluttaki daha yeniyse ezme
    if (Object.keys(state.meta).length) {
      let cloudNewer = false;
      try {
        const snap = await fs.getDoc(fs.doc(fs.db, P() + '/meta/settings'));
        if (snap.exists()) {
          const m = await open(snap.data().e);
          if ((m.mu || snap.data().u || 0) >= (state.meta.mu || 1)) cloudNewer = true;
        }
      } catch (e) {}
      if (!cloudNewer) await fsPut('meta/settings', state.meta, state.meta.mu);
    }
  }

  // ---------- dış API ----------
  window.AppSync = {
    state,
    on: (kind, fn) => { (listeners[kind] = listeners[kind] || []).push(fn); },

    // --- kimlik / eşleşme ---
    isPaired: () => !!state.pair,
    hasConfig: () => !!window.FIREBASE_CONFIG,
    who: () => (state.pair && state.pair.who) || localStorage.getItem('s365_who') || 'B',

    // "Ben Berk / Ben Damla" — sabit ortak alana bağlanır
    usePair: (who) => {
      try { localStorage.setItem('s365_who', who); } catch (e) {}
      const changed = !state.pair || state.pair.id !== FIXED.id;
      state.pair = { id: FIXED.id, key: FIXED.key, who };
      write(LS.pair, state.pair);
      if (changed) { aesKey = null; fs = null; }
      connect();
    },

    // --- döngü ---
    getCycle: () => state.cycle,
    saveCycleDay: (dayKey, entry) => {
      state.cycle[dayKey] = entry;
      write(LS.cycle, state.cycle);
      emit('cycle');
      fsPut('cycle/' + dayKey, entry);
    },
    deleteCycleDay: (dayKey) => {
      delete state.cycle[dayKey];
      write(LS.cycle, state.cycle);
      emit('cycle');
      fsDel('cycle/' + dayKey);
    },

    // --- ayarlar ---
    getMeta: () => state.meta,
    saveMeta: (patch) => {
      Object.assign(state.meta, patch);
      state.meta.mu = Date.now();
      write(LS.meta, state.meta);
      fsPut('meta/settings', state.meta, state.meta.mu);
    },

    // --- rutinler ---
    getRoutines: () => state.routines,
    saveRoutine: (rid, r) => {
      state.routines[rid] = r;
      write(LS.routines, state.routines);
      emit('routine');
      fsPut('routines/' + rid, r);
    },
    deleteRoutine: (rid) => {
      delete state.routines[rid];
      for (const d in state.rchecks) {
        if (state.rchecks[d][rid]) { delete state.rchecks[d][rid]; fsDel('rchecks/' + d + '_' + rid); }
      }
      write(LS.routines, state.routines);
      write(LS.rchecks, state.rchecks);
      emit('routine');
      fsDel('routines/' + rid);
    },
    getRChecks: (date) => state.rchecks[date] || {},
    setRCheck: (date, rid, on) => {
      const day = state.rchecks[date] = state.rchecks[date] || {};
      if (on) day[rid] = true; else delete day[rid];
      write(LS.rchecks, state.rchecks);
      emit('routine');
      if (on) fsPut('rchecks/' + date + '_' + rid, { v: 1 });
      else fsDel('rchecks/' + date + '_' + rid);
    },

    // --- market ---
    getLists: () => state.lists,
    getItems: (listId) => state.items[listId] || {},
    createList: (name, icon, kind) => {
      const id = 'l' + Date.now().toString(36);
      const maxO = Math.max(0, ...Object.values(state.lists).map((l) => l.o || 0));
      state.lists[id] = { name, icon, o: maxO + 1 };
      if (kind) state.lists[id].kind = kind;
      write(LS.lists, state.lists);
      emit('market');
      fsPut('lists/' + id, state.lists[id]);
      return id;
    },
    deleteList: (listId) => {
      delete state.lists[listId];
      const its = state.items[listId] || {};
      delete state.items[listId];
      write(LS.lists, state.lists); write(LS.items, state.items);
      emit('market');
      fsDel('lists/' + listId);
      for (const iid in its) fsDel('items/' + iid);
    },
    saveItem: (listId, itemId, item) => {
      item.list = listId;
      if (!state.items[listId]) state.items[listId] = {};
      state.items[listId][itemId] = item;
      write(LS.items, state.items);
      emit('market');
      fsPut('items/' + itemId, item);
    },
    deleteItem: (listId, itemId) => {
      if (state.items[listId]) delete state.items[listId][itemId];
      write(LS.items, state.items);
      emit('market');
      fsDel('items/' + itemId);
    }
  };

  // ---------- başlangıç ----------
  // Eski kod-link eşleşmesinden sabit alana kendiliğinden geçiş:
  // kimlik (B/D) ve yereldeki TÜM veri korunur, bulutla birleştirilir.
  if (state.pair && state.pair.id !== FIXED.id) {
    state.pair = { id: FIXED.id, key: FIXED.key, who: state.pair.who || localStorage.getItem('s365_who') || 'B' };
    write(LS.pair, state.pair);
    queue = [];                    // eski alana ait bekleyenler geçersiz; pushAllLocal hepsini yeniden taşır
    write(LS.queue, queue);
  }
  if (state.pair) connect();
})();
