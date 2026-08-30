/* ============ Senkron katmanı ============
   - Eşleşme: iki cihaz ortak bir "bağlantı kodu" ile aynı veriyi görür.
   - Şifreleme: tüm içerik cihazda AES-GCM ile şifrelenir; buluta yalnızca
     şifreli veri gider (anahtar sadece kodda / cihazlarda durur).
   - Config yoksa ya da internet yoksa localStorage ile çalışır;
     bağlantı gelince otomatik senkronize olur.                         */

(function () {
  'use strict';

  const LS = {
    pair:  's365_pair',      // {id, key(b64url), who: 'B'|'D'}
    cycle: 's365_cycle',     // {'YYYY-MM-DD': {f,s,m,n}}
    lists: 's365_lists',     // {listId: {name, icon, o}}
    items: 's365_items',     // {listId: {itemId: {n,q,note,c,by,done,u}}}
    meta:  's365_meta'       // {cycleLen, periodLen, hist:{name:count}}
  };

  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  const state = {
    pair: read(LS.pair, null),
    cycle: read(LS.cycle, {}),
    lists: read(LS.lists, {}),
    items: read(LS.items, {}),
    meta: read(LS.meta, {}),
    online: false,          // Firestore bağlantısı kuruldu mu
    mode: 'local'           // 'local' | 'sync'
  };

  // Varsayılan listeler
  if (!state.lists['market']) state.lists['market'] = { name: 'Market alışverişi', icon: '🛒', o: 0 };
  else if (state.lists['market'].name === 'Market') state.lists['market'].name = 'Market alışverişi';
  if (!state.lists['online']) state.lists['online'] = { name: 'Online alışveriş', icon: '💻', o: 1 };
  write(LS.lists, state.lists);

  let fs = null;            // {db, doc, setDoc, deleteDoc, collection, onSnapshot}
  let aesKey = null;
  const listeners = { cycle: [], market: [], status: [] };

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

  // ---------- Firestore ----------
  async function connect() {
    if (!window.FIREBASE_CONFIG || !state.pair) return;
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
        doc: fsM.doc, setDoc: fsM.setDoc, deleteDoc: fsM.deleteDoc,
        collection: fsM.collection, onSnapshot: fsM.onSnapshot
      };
      state.mode = 'sync';
      subscribe();
      await pushAllLocal();   // yerel birikmişleri buluta taşı (ilk kurulumda)
      state.online = true;
      emit('status');
    } catch (e) {
      // internet yok / SDK inmedi: yerel modda devam
      state.online = false;
      emit('status');
    }
  }

  const P = () => 'pairs/' + state.pair.id;

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
      if (changed) { write(LS.lists, state.lists); write(LS.items, state.items); emit('market'); }
    }, () => {});

    // Ürünler (tek koleksiyonda, listId alanıyla)
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
      if (changed) { write(LS.items, state.items); emit('market'); }
    }, () => {});

    // Ayarlar
    fs.onSnapshot(fs.doc(fs.db, P() + '/meta/settings'), async (snap) => {
      if (!snap.exists()) return;
      try {
        state.meta = await open(snap.data().e);
        write(LS.meta, state.meta); emit('cycle'); emit('market');
      } catch (e) {}
    }, () => {});
  }

  async function fsPut(path, obj) {
    if (!fs) return;
    try { await fs.setDoc(fs.doc(fs.db, path), { e: await seal(obj), u: Date.now() }); } catch (e) {}
  }
  async function fsDel(path) {
    if (!fs) return;
    try { await fs.deleteDoc(fs.doc(fs.db, path)); } catch (e) {}
  }

  async function pushAllLocal() {
    for (const k in state.cycle) await fsPut(P() + '/cycle/' + k, state.cycle[k]);
    for (const k in state.lists) await fsPut(P() + '/lists/' + k, state.lists[k]);
    for (const lid in state.items)
      for (const iid in state.items[lid]) await fsPut(P() + '/items/' + iid, state.items[lid][iid]);
    if (Object.keys(state.meta).length) await fsPut(P() + '/meta/settings', state.meta);
  }

  // ---------- dış API ----------
  window.AppSync = {
    state,
    on: (kind, fn) => { (listeners[kind] = listeners[kind] || []).push(fn); },

    // --- eşleşme ---
    isPaired: () => !!state.pair,
    hasConfig: () => !!window.FIREBASE_CONFIG,
    who: () => (state.pair && state.pair.who) || localStorage.getItem('s365_who') || 'B',

    createPair: async (who) => {
      const id = b64u.enc(crypto.getRandomValues(new Uint8Array(9)).buffer);
      const key = b64u.enc(crypto.getRandomValues(new Uint8Array(32)).buffer);
      state.pair = { id, key, who };
      write(LS.pair, state.pair);
      aesKey = null;
      await connect();
      return id + '.' + key;
    },

    joinPair: async (code, who) => {
      const m = String(code || '').trim().split('.');
      if (m.length !== 2 || m[0].length < 8 || m[1].length < 40) return false;
      state.pair = { id: m[0], key: m[1], who };
      write(LS.pair, state.pair);
      aesKey = null;
      await connect();
      return true;
    },

    shareCode: () => (state.pair ? state.pair.id + '.' + state.pair.key : null),
    setWho: (w) => {
      try { localStorage.setItem('s365_who', w); } catch (e) {}
      if (state.pair) { state.pair.who = w; write(LS.pair, state.pair); }
    },

    unpair: () => {
      state.pair = null; aesKey = null; fs = null;
      state.mode = 'local'; state.online = false;
      write(LS.pair, null);
      emit('status');
    },

    // --- döngü ---
    getCycle: () => state.cycle,
    saveCycleDay: (dayKey, entry) => {
      state.cycle[dayKey] = entry;
      write(LS.cycle, state.cycle);
      emit('cycle');
      fsPut(P0() + '/cycle/' + dayKey, entry);
    },
    deleteCycleDay: (dayKey) => {
      delete state.cycle[dayKey];
      write(LS.cycle, state.cycle);
      emit('cycle');
      fsDel(P0() + '/cycle/' + dayKey);
    },

    // --- ayarlar ---
    getMeta: () => state.meta,
    saveMeta: (patch) => {
      Object.assign(state.meta, patch);
      write(LS.meta, state.meta);
      fsPut(P0() + '/meta/settings', state.meta);
    },

    // --- market ---
    getLists: () => state.lists,
    getItems: (listId) => state.items[listId] || {},
    createList: (name, icon) => {
      const id = 'l' + Date.now().toString(36);
      state.lists[id] = { name, icon, o: Object.keys(state.lists).length };
      write(LS.lists, state.lists);
      emit('market');
      fsPut(P0() + '/lists/' + id, state.lists[id]);
      return id;
    },
    deleteList: (listId) => {
      delete state.lists[listId];
      const its = state.items[listId] || {};
      delete state.items[listId];
      write(LS.lists, state.lists); write(LS.items, state.items);
      emit('market');
      fsDel(P0() + '/lists/' + listId);
      for (const iid in its) fsDel(P0() + '/items/' + iid);
    },
    saveItem: (listId, itemId, item) => {
      item.list = listId;
      if (!state.items[listId]) state.items[listId] = {};
      state.items[listId][itemId] = item;
      write(LS.items, state.items);
      emit('market');
      fsPut(P0() + '/items/' + itemId, item);
    },
    deleteItem: (listId, itemId) => {
      if (state.items[listId]) delete state.items[listId][itemId];
      write(LS.items, state.items);
      emit('market');
      fsDel(P0() + '/items/' + itemId);
    }
  };

  // pair yokken fsPut çağrılırsa patlamasın
  function P0() { return state.pair ? 'pairs/' + state.pair.id : 'pairs/_'; }

  // başlangıç
  if (state.pair) connect();
})();
