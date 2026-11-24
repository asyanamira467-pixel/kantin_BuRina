'use strict';
/* ===== Halaman kasir: papan pesanan 4 jalur (Baru -> Diproses -> Siap -> Selesai) ===== */

const API = 'api/';
const S = {
  pin: sessionStorage.getItem('pin') || '',
  kantin: [],
  kid: null,
  orders: [],
  known: null,   // id pesanan yang sudah terlihat (untuk bunyi pesanan baru)
  modal: null,
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
const pad = (n) => String(n).padStart(3, '0');

let toastTimer;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2800);
}

function beep() {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const o = c.createOscillator(); const g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.frequency.value = 880; g.gain.value = 0.15;
    o.start(); setTimeout(() => { o.stop(); c.close(); }, 350);
  } catch { /* browser menolak suara, abaikan */ }
}

async function kapi(path, opts = {}) {
  const res = await fetch(API + path, { ...opts, headers: { ...(opts.headers || {}), 'X-Kasir-Pin': S.pin } });
  let data;
  try { data = await res.json(); }
  catch { throw new Error('Server tidak merespons. Cek Apache dan MySQL di XAMPP.'); }
  if (res.status === 401) { logout(); throw new Error(data.error || 'PIN salah'); }
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}
const post = (path, body) => kapi(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/* ---------- Login PIN ---------- */
function loginHTML() {
  return `<div class="stage" style="grid-template-columns:minmax(0,420px);justify-content:center;padding-top:70px">
    <section class="panel">
      <div class="titlebar"><span>🔑 Kasir Bu Rina</span></div>
      <label class="lbl" for="pin">Masukkan PIN kasir</label>
      <input type="text" id="pin" inputmode="numeric" autocomplete="off" style="-webkit-text-security:disc" placeholder="••••">
      <button class="cta" data-act="login" style="margin-top:16px">Masuk</button>
      <p class="muted" style="margin-top:14px"><a href="index.html">← Ke halaman pembeli</a></p>
    </section>
  </div>`;
}

function logout() {
  sessionStorage.removeItem('pin');
  S.pin = '';
  S.known = null;
  $('#modal-root').innerHTML = '';
  $('#app').innerHTML = loginHTML();
}

async function login() {
  const pin = $('#pin').value.trim();
  if (!pin) return;
  S.pin = pin;
  try {
    await kapi('kasir.php?aksi=rekap&kantin_id=1');
    sessionStorage.setItem('pin', pin);
    await start();
  } catch (err) { toast(err.message); }
}

/* ---------- Papan pesanan ---------- */
const LANES = [
  { key: 'baru', title: '🆕 Baru' },
  { key: 'diproses', title: '🔥 Diproses' },
  { key: 'siap', title: '✅ Siap' },
  { key: 'selesai', title: '📦 Selesai' },
];

function cardHTML(o) {
  const items = o.items.map((it) => `<li>${it.jumlah}× ${esc(it.emoji || '')} ${esc(it.nama_menu)}${it.opsi.length ? `<br><span class="sub">${esc(it.opsi.join(', '))}</span>` : ''}${it.catatan ? `<br><span class="sub">📝 ${esc(it.catatan)}</span>` : ''}</li>`).join('');
  let acts = '';
  if (o.status === 'baru') acts = `<button class="btn-small blue" data-act="set" data-id="${o.id}" data-status="diproses">Proses</button><button class="btn-small red" data-act="set" data-id="${o.id}" data-status="batal">Batal</button>`;
  if (o.status === 'diproses') acts = `<button class="btn-small green" data-act="set" data-id="${o.id}" data-status="siap">Siap</button>`;
  if (o.status === 'siap') acts = `<button class="btn-small" data-act="set" data-id="${o.id}" data-status="selesai">Selesai</button>`;
  return `<div class="kcard ${o.status === 'batal' ? 'selesai' : o.status}">
    <div class="no">#${pad(o.nomor_antrean)} ${o.status === 'batal' ? '<small>(batal)</small>' : ''}</div>
    <div class="sub" style="font-family:Arial,sans-serif;font-weight:700;font-size:13px">${esc(o.nama_pemesan)} · ${esc(o.metode_bayar)} · ${esc(String(o.dibuat_pada).slice(11, 16))}</div>
    <ul>${items}</ul>
    ${o.catatan ? `<div class="sub" style="font-family:Arial,sans-serif;font-size:13px">📝 ${esc(o.catatan)}</div>` : ''}
    <div style="margin-top:4px">${rp(o.total)}</div>
    ${acts ? `<div class="acts">${acts}</div>` : ''}
  </div>`;
}

function mainHTML() {
  const k = S.kantin.find((x) => Number(x.id) === Number(S.kid)) || {};
  const tabs = S.kantin.map((x) => `<button class="${Number(x.id) === Number(S.kid) ? 'on' : ''}" data-act="pick" data-id="${x.id}">${esc(x.emoji)} ${esc(x.nama)}</button>`).join('');
  const lanes = LANES.map((l) => {
    const list = S.orders.filter((o) => (l.key === 'selesai' ? ['selesai', 'batal'].includes(o.status) : o.status === l.key));
    return `<div class="lane"><h3>${l.title}<span>${list.length}</span></h3>${list.map(cardHTML).join('') || '<div style="color:#6c6c78;text-align:center;padding:20px 0">—</div>'}</div>`;
  }).join('');
  return `<div class="stage">
    <section class="panel">
      <div class="titlebar"><span>${esc(k.emoji || '🔑')} Kasir · ${esc(k.nama || '')}</span><span class="count">${S.orders.length} pesanan hari ini</span></div>
      <div class="kantin-tabs">${tabs}</div>
      <div class="lanes">${lanes}</div>
    </section>
    <aside class="side">
      <div class="top-actions">
        <a class="round-btn" href="index.html" title="Halaman pembeli">🏠</a>
        <button class="round-btn" data-act="logout" title="Keluar">⏻</button>
      </div>
      <button class="ticket" data-act="rekap">📊 Rekap Hari Ini</button>
      <button class="ticket t2" data-act="stok">🍽️ Stok Menu</button>
      <button class="ticket t3" data-act="refresh">🔄 Segarkan</button>
    </aside>
  </div>`;
}

async function refresh(showError) {
  if (!S.pin || !S.kid) return;
  try {
    const list = await kapi(`kasir.php?aksi=pesanan&kantin_id=${S.kid}`);
    const ids = new Set(list.map((o) => o.id));
    if (S.known) {
      const baru = list.filter((o) => !S.known.has(o.id) && o.status === 'baru');
      if (baru.length) { beep(); toast(`${baru.length} pesanan baru masuk! 🔔`); }
    }
    S.known = ids;
    S.orders = list;
    if (!S.modal) $('#app').innerHTML = mainHTML();
  } catch (err) { if (showError) toast(err.message); }
}

/* ---------- Modal: rekap & stok ---------- */
function openModal(html) { $('#modal-root').innerHTML = `<div class="overlay" data-overlay><div class="modal">${html}</div></div>`; }
function closeModal() { $('#modal-root').innerHTML = ''; S.modal = null; refresh(); }
const CLOSE_BTN = '<button class="round-btn x" style="width:44px;height:44px;font-size:20px" data-act="close" aria-label="Tutup">✕</button>';

async function openRekap() {
  S.modal = 'rekap';
  openModal(`${CLOSE_BTN}<h2>Rekap Hari Ini</h2><div class="muted">Memuat…</div>`);
  try {
    const r = await kapi(`kasir.php?aksi=rekap&kantin_id=${S.kid}`);
    $('#modal-root .modal').innerHTML = `${CLOSE_BTN}<h2>Rekap Hari Ini</h2>
      <div class="stat-grid">
        <div class="stat"><b>${r.jumlah_pesanan}</b>Pesanan</div>
        <div class="stat"><b>${rp(r.omzet)}</b>Omzet</div>
        <div class="stat"><b>${r.aktif}</b>Sedang berjalan</div>
        <div class="stat"><b>${r.selesai}</b>Selesai</div>
      </div>
      <div class="group"><h4>Menu terlaris</h4>${r.terlaris.length ? r.terlaris.map((t) => `<div class="menu-row"><span class="n">${esc(t.nama_menu)}</span><b>${t.terjual}×</b></div>`).join('') : '<div class="muted">Belum ada penjualan.</div>'}</div>`;
  } catch (err) { toast(err.message); }
}

async function openStok() {
  S.modal = 'stok';
  openModal(`${CLOSE_BTN}<h2>Stok Menu</h2><div class="muted">Memuat…</div>`);
  await renderStok();
}
async function renderStok() {
  try {
    const list = await kapi(`kasir.php?aksi=menu&kantin_id=${S.kid}`);
    $('#modal-root .modal').innerHTML = `${CLOSE_BTN}<h2>Stok Menu</h2><div class="muted">Tandai menu yang habis agar tidak bisa dipesan.</div>
      <div class="group">${list.map((m) => {
        const ada = Number(m.tersedia) === 1;
        return `<div class="menu-row"><span style="font-size:28px">${esc(m.emoji)}</span><span class="n">${esc(m.nama)}<br><span class="muted">${rp(m.harga)}</span></span>
          <button class="btn-small ${ada ? 'green' : 'red'}" data-act="toggle" data-id="${m.id}" data-on="${ada ? 0 : 1}">${ada ? 'Tersedia' : 'Habis'}</button></div>`;
      }).join('')}</div>`;
  } catch (err) { toast(err.message); }
}

/* ---------- Event ---------- */
document.addEventListener('click', async (e) => {
  if (e.target.matches('[data-overlay]')) return closeModal();
  const el = e.target.closest('[data-act]');
  if (!el) return;
  try {
    switch (el.dataset.act) {
      case 'login': await login(); break;
      case 'logout': logout(); break;
      case 'pick': S.kid = Number(el.dataset.id); S.known = null; S.orders = []; await refresh(true); break;
      case 'refresh': await refresh(true); toast('Diperbarui'); break;
      case 'set':
        if (el.dataset.status === 'batal' && !confirm('Batalkan pesanan ini?')) return;
        await post('kasir.php?aksi=status', { id: Number(el.dataset.id), status: el.dataset.status });
        await refresh(true);
        break;
      case 'rekap': openRekap(); break;
      case 'stok': openStok(); break;
      case 'toggle':
        await post('kasir.php?aksi=tersedia', { id: Number(el.dataset.id), tersedia: Number(el.dataset.on) });
        await renderStok();
        break;
      case 'close': closeModal(); break;
    }
  } catch (err) { toast(err.message); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && $('#pin')) login();
  if (e.key === 'Escape' && S.modal) closeModal();
});

/* ---------- Mulai ---------- */
let timer;
async function start() {
  if (!S.kantin.length) {
    const res = await fetch(API + 'kantin.php');
    S.kantin = await res.json();
  }
  S.kid = S.kid || (S.kantin[0] && S.kantin[0].id);
  await refresh(true);
  clearInterval(timer);
  timer = setInterval(() => refresh(false), 5000);
}

if (S.pin) start().catch((err) => { toast(err.message); logout(); });
else $('#app').innerHTML = loginHTML();
