/* ============ 365 Sebep — uygulama mantığı ============ */

const WEDDING_DATE = new Date(2024, 7, 10);   // 10 Ağustos 2024
const LAUNCH_DATE  = new Date(2026, 7, 10);   // 10 Ağustos 2026 — Sebep #1
const MS_DAY = 86400000;

const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

// Özel günler (sebep numarasına göre)
const SPECIAL_DAYS = {
  1:   '🎉 Bugün 2. evlilik yıldönümümüz! İyi ki evlendik güzelim. 💍',
  99:  '💑 4 yıl önce bugün sevgili olduk! (16 Kasım 2022)',
  145: '🎆 Mutlu yıllar sütlacım! Yeni yılın ilk sebebi senin.',
  189: '💘 Sevgililer Günümüz kutlu olsun ballı çöreğim!',
  261: '💍 3 yıl önce bugün nişanlandık! (27 Nisan 2024)',
  317: '🗼 4 yıl önce bugün Paris\'te sana evlenme teklif ettim!',
  365: '🥹 365. sebep! Bir yıl boyunca her gün buradaydın. Yarın 3. yıldönümümüz…'
};

// ---------- Açılış saati ----------
// Sebep #1 her zaman görünür (link ne zaman açılırsa açılsın).
// Sebep #2'den itibaren her sabah Türkiye saatiyle 10:00'da bir yenisi açılır.
// TR = UTC+3, yaz saati yok. Mutlak zamana bağlı: cihazın saat dilimi önemsiz.
const UNLOCK_SECOND = Date.UTC(2026, 7, 11, 7, 0, 0);  // 11 Ağustos 2026, 10:00 TR

function currentDayNumber(now) {
  const t = now.getTime();
  if (t < UNLOCK_SECOND) return 1;
  return Math.floor((t - UNLOCK_SECOND) / MS_DAY) + 2;
}

// Bir sonraki notun açılacağı an
function nextUnlockTime(dayNo) {
  return UNLOCK_SECOND + Math.max(0, dayNo - 1) * MS_DAY;
}

// Onizleme: ?ironman=42 -> 42. gunu gosterir. Gecersiz deger yok sayilir.
function previewDay() {
  const n = parseInt(new URLSearchParams(location.search).get('ironman'), 10);
  return (n >= 1 && n <= 365) ? n : null;
}

function noteForDay(n) {
  // 365'ten sonra baştan döner
  const idx = ((n - 1) % NOTES.length + NOTES.length) % NOTES.length;
  return NOTES[idx];
}

function dateOfDay(n) {
  return new Date(LAUNCH_DATE.getTime() + (n - 1) * MS_DAY);
}

function formatDate(d) {
  return d.getDate() + ' ' + AYLAR[d.getMonth()] + ' ' + d.getFullYear();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------- Başlatma ----------
const $ = (id) => document.getElementById(id);
let DAY_NO = previewDay() || currentDayNumber(new Date());
let TODAY = dateOfDay(DAY_NO);

function init() {
  spawnHearts();
  $('app').classList.remove('hidden');
  renderToday();
  renderArchive();
  setupNav();
  setupSettings();
  setupTruf();
  scheduleAutoRefresh();
  if (DAY_NO === 1 || SPECIAL_DAYS[DAY_NO]) launchConfetti();
}

// ---------- Bugün ----------
function renderToday() {
  const marriedDays = Math.floor((TODAY - WEDDING_DATE) / MS_DAY);
  $('married-days').textContent = marriedDays.toLocaleString('tr-TR');

  const n = Math.min(DAY_NO, 100000);
  $('note-no').textContent = '#' + (((n - 1) % NOTES.length) + 1);
  $('note-date').textContent = formatDate(TODAY);
  $('note-text').textContent = noteForDay(n);

  const badge = $('special-badge');
  if (SPECIAL_DAYS[n]) {
    badge.textContent = SPECIAL_DAYS[n];
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  $('btn-save').addEventListener('click', () => saveNoteImage(((n - 1) % NOTES.length) + 1, noteForDay(n), formatDate(TODAY)));
  $('btn-tomorrow').addEventListener('click', showRejection);
  $('reject-close').addEventListener('click', () => $('reject-modal').classList.add('hidden'));
}

function showRejection() {
  $('reject-emoji').textContent = pick(['😏','🙅‍♂️','⏳','🍮','😌','🤨','🤍','😜']);
  $('reject-text').textContent = pick(REJECTIONS);
  $('reject-countdown').textContent = remainingText();
  $('reject-modal').classList.remove('hidden');
}

// "Yeni sebep 4 saat 12 dakika sonra" — kalan süreyi yazar
function remainingText() {
  const diff = nextUnlockTime(DAY_NO) - Date.now();
  if (diff <= 0) return '';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const parts = [];
  if (h > 0) parts.push(h + ' saat');
  parts.push(m + ' dakika');
  return '⏳ Yeni sebep ' + parts.join(' ') + ' sonra açılıyor.';
}

// Açılış saati gelince sayfayı kendiliğinden tazele
function scheduleAutoRefresh() {
  if (previewDay()) return;
  const diff = nextUnlockTime(DAY_NO) - Date.now();
  if (diff > 0 && diff < 2147483647) setTimeout(() => location.reload(), diff + 2000);
}

// ---------- Arşiv ----------
function renderArchive() {
  const list = $('archive-list');
  list.innerHTML = '';
  const upto = Math.min(DAY_NO, NOTES.length);
  $('archive-sub').textContent = upto <= 1
    ? 'Henüz arşivde bir şey yok — her gün buraya bir sebep eklenecek. 🌱'
    : `Şu ana kadar ${upto} sebep birikti. 💝`;

  for (let i = upto; i >= 1; i--) {
    const item = document.createElement('div');
    item.className = 'archive-item';
    const d = dateOfDay(i);
    item.innerHTML =
      `<div class="ai-no">#${i}</div>
       <div>
         <div class="ai-preview"></div>
         <div class="ai-date">${formatDate(d)}</div>
       </div>`;
    item.querySelector('.ai-preview').textContent = noteForDay(i);
    item.addEventListener('click', () => openArchiveNote(i));
    list.appendChild(item);
  }
}

function openArchiveNote(n) {
  $('am-no').textContent = '#' + n;
  $('am-date').textContent = formatDate(dateOfDay(n));
  $('am-text').textContent = noteForDay(n);
  $('archive-modal').classList.remove('hidden');
  $('am-close').onclick = () => $('archive-modal').classList.add('hidden');
  $('am-save').onclick = () => saveNoteImage(n, noteForDay(n), formatDate(dateOfDay(n)));
}

// ---------- Navigasyon ----------
const VIEWS = ['today-view', 'archive-view', 'cycle-view', 'market-view'];
function setupNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      VIEWS.forEach(v => $(v).classList.toggle('hidden', btn.dataset.view !== v));
      window.scrollTo({ top: 0 });
    });
  });
}

// ---------- Ayarlar / eşleşme ----------
function renderSettings() {
  const info = $('st-pair-info');
  const actions = $('st-pair-actions');
  const who = AppSync.who();
  document.querySelectorAll('#st-who .chip').forEach(c => c.classList.toggle('on', c.dataset.w === who));

  if (!AppSync.hasConfig()) {
    info.innerHTML = 'Senkron altyapısı henüz kurulmadı. Şimdilik veriler bu telefonda saklanıyor; kurulum tamamlanınca otomatik eşitlenecek. ✨';
    actions.innerHTML = '';
    return;
  }
  if (AppSync.isPaired()) {
    const st = AppSync.state;
    info.innerHTML = 'Eşleşme aktif. ' + (st.online ? 'Bulut bağlantısı: <b>bağlı</b> ✅' : 'Bulut bağlantısı: bekleniyor…') +
      '<br>Diğer cihazı bağlamak için kodu paylaş:';
    actions.innerHTML =
      '<button class="btn btn-primary btn-sm" id="st-copy">Bağlantı kodunu kopyala</button>' +
      '<button class="btn-link-danger" id="st-unpair">Bu cihazı ayır</button>';
    $('st-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(AppSync.shareCode()); $('st-copy').textContent = 'Kopyalandı ✓'; } catch (e) {
        prompt('Kodu kopyala:', AppSync.shareCode());
      }
    });
    $('st-unpair').addEventListener('click', () => { if (confirm('Bu cihaz eşleşmeden ayrılsın mı? (Veriler silinmez)')) { AppSync.unpair(); renderSettings(); } });
  } else {
    info.innerHTML = 'Henüz eşleşme yok. İlk cihazda "bağlantı oluştur", ikincisinde kodu yapıştırıp "katıl".';
    actions.innerHTML =
      '<button class="btn btn-primary btn-sm" id="st-create">Yeni bağlantı oluştur</button>' +
      '<div class="st-join"><input id="st-code" type="text" placeholder="Bağlantı kodunu yapıştır"><button class="btn btn-ghost btn-sm" id="st-join">Katıl</button></div>';
    $('st-create').addEventListener('click', async () => {
      const who2 = AppSync.who();
      await AppSync.createPair(who2);
      renderSettings();
    });
    $('st-join').addEventListener('click', async () => {
      const ok = await AppSync.joinPair($('st-code').value, AppSync.who());
      if (!ok) { $('st-code').value = ''; $('st-code').placeholder = 'Kod geçersiz, tekrar dene'; }
      renderSettings();
    });
  }
}

function setupSettings() {
  $('settings-btn').addEventListener('click', () => { renderSettings(); $('settings-modal').classList.remove('hidden'); });
  $('st-close').addEventListener('click', () => $('settings-modal').classList.add('hidden'));
  document.querySelectorAll('#st-who .chip').forEach(c => c.addEventListener('click', () => {
    AppSync.setWho(c.dataset.w);
    document.querySelectorAll('#st-who .chip').forEach(x => x.classList.toggle('on', x === c));
  }));
  AppSync.on('status', () => { if (!$('settings-modal').classList.contains('hidden')) renderSettings(); });
}

// ---------- Trüf 🐈 ----------
function setupTruf() {
  let toastTimer;
  $('truf-btn').addEventListener('click', () => {
    const toast = $('truf-toast');
    toast.textContent = 'Trüf: ' + pick(TRUF_LINES);
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 4500);
  });
}

// ---------- Görsel olarak kaydet ----------
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
  return lines.length;
}

async function saveNoteImage(no, text, dateStr) {
  const canvas = $('share-canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Arka plan
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#fffdfa');
  grad.addColorStop(0.6, '#fdf3ec');
  grad.addColorStop(1, '#fbe9e2');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Çerçeve
  ctx.strokeStyle = '#d4af7a';
  ctx.lineWidth = 4;
  ctx.strokeRect(50, 50, W - 100, H - 100);
  ctx.strokeStyle = '#f3e5d0';
  ctx.lineWidth = 2;
  ctx.strokeRect(66, 66, W - 132, H - 132);

  ctx.textAlign = 'center';

  // Üst süsleme
  ctx.font = '52px serif';
  ctx.fillStyle = '#d4af7a';
  ctx.fillText('✦  💌  ✦', W / 2, 190);

  // Başlık
  ctx.fillStyle = '#d4737f';
  ctx.font = 'bold 76px Georgia, serif';
  ctx.fillText('Sebep #' + no, W / 2, 320);

  ctx.fillStyle = '#9a8c85';
  ctx.font = '34px Georgia, serif';
  ctx.fillText(dateStr, W / 2, 380);

  // Ayraç
  ctx.strokeStyle = '#d4af7a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 90, 440);
  ctx.lineTo(W / 2 + 90, 440);
  ctx.stroke();

  // Not metni
  ctx.fillStyle = '#4a3f3a';
  ctx.font = '46px Georgia, serif';
  wrapText(ctx, text, W / 2, 700, W - 260, 68);

  // İmza
  ctx.fillStyle = '#d4737f';
  ctx.font = 'italic 44px Georgia, serif';
  ctx.fillText('— Berk ❤️', W / 2, H - 220);

  // Alt yazı
  ctx.fillStyle = '#c9b8ae';
  ctx.font = '28px Georgia, serif';
  ctx.fillText('365 Sebep 💌 Seni sevmemin 365 sebebi', W / 2, H - 130);

  canvas.toBlob(async (blob) => {
    const file = new File([blob], `sebep-${no}.png`, { type: 'image/png' });
    // iPhone'da paylaşım menüsü → "Görseli Kaydet" ile galeriye eklenir
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Sebep #' + no });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return; // kullanıcı vazgeçti
      }
    }
    // Masaüstü / desteklenmeyen tarayıcı: indir
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sebep-${no}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}

// ---------- Süslemeler ----------
function spawnHearts() {
  const bg = $('hearts-bg');
  const emojis = ['🤍','💗','✨','💛','🌸'];
  for (let i = 0; i < 14; i++) {
    const el = document.createElement('div');
    el.className = 'floating-heart';
    el.textContent = emojis[i % emojis.length];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.fontSize = 14 + Math.random() * 18 + 'px';
    el.style.animationDuration = 14 + Math.random() * 16 + 's';
    el.style.animationDelay = Math.random() * 18 + 's';
    bg.appendChild(el);
  }
}

function launchConfetti() {
  const colors = ['#e8a0a8', '#d4af7a', '#f3e5d0', '#d4737f', '#ffffff'];
  for (let i = 0; i < 80; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.width = 8 + Math.random() * 8 + 'px';
    c.style.height = 10 + Math.random() * 10 + 'px';
    c.style.background = colors[i % colors.length];
    c.style.borderRadius = Math.random() > 0.5 ? '50%' : '3px';
    c.style.animationDuration = 2.5 + Math.random() * 3 + 's';
    c.style.animationDelay = Math.random() * 1.5 + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 7000);
  }
}

// ---------- Service worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}

init();
