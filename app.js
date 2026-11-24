'use strict';
/* ===== Halaman pembeli: Kantin Bu Rina =====
   Alur: Beranda (pilih kantin) -> Menu kantin -> Detail menu -> Keranjang/Checkout -> Antrean */

const API = 'api/';

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* abaikan */ }
}

const state = {
  view: 'home',            // 'home' | 'menu'
  kantin: [],
  current: null,           // kantin yang sedang dibuka
  menu: [],
  cart: load('cart', []),  // [{key, menu_id, nama, emoji, harga, jumlah, catatan, opsi:[{id,nama,tambah}]}]
  cartKantin: load('cartKantin', null),
  orders: load('orders', []),   // id pesanan milik perangkat ini
  statusMap: {},
  activeCount: 0,
  modal: null,             // 'detail' | 'checkout' | 'ticket' | 'queue' | 'history'
  detail: null,
  draft: { nama: load('nama', ''), catatan: '', metode: 'tunai' },
};

/* ---------- Helper ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
const pad = (n) => String(n).padStart(3, '0');

async function api(path, opts) {
  const res = await fetch(API + path, opts);
  let data;
  try { data = await res.json(); }
  catch { throw new Error('Server tidak merespons. Pastikan Apache dan MySQL di XAMPP sudah menyala.'); }
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

let toastTimer;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2800);
}

/* ---------- Keranjang ---------- */
const cartCount = () => state.cart.reduce((a, l) => a + l.jumlah, 0);
const lineUnit = (l) => l.harga + l.opsi.reduce((a, o) => a + o.tambah, 0);
const cartTotal = () => state.cart.reduce((a, l) => a + lineUnit(l) * l.jumlah, 0);
function saveCart() { save('cart', state.cart); save('cartKantin', state.cartKantin); }

/* ---------- Modal ---------- */
function openModal(html) {
  $('#modal-root').innerHTML = `<div class="overlay" data-overlay><div class="modal">${html}</div></div>`;
}
function setModalHTML(html) {
  const m = $('#modal-root .modal');
  if (m) m.innerHTML = html;
}
function closeModal() {
  $('#modal-root').innerHTML = '';
  state.modal = null;
  state.detail = null;
}
const CLOSE_BTN = '<button class="round-btn x" style="width:44px;height:44px;font-size:20px" data-act="close" aria-label="Tutup">✕</button>';

/* ---------- Tampilan: Beranda ---------- */
function homeHTML() {
  const tiles = state.kantin.map((k) => {
    const buka = Number(k.buka) === 1;
    return `<button class="tile ${buka ? '' : 'closed'}" ${buka ? '' : 'disabled'} data-act="pick-kantin" data-id="${k.id}" style="background:${esc(k.warna)}33">
      <span class="emoji">${esc(k.emoji)}</span>
      <span class="name">${esc(k.nama)}</span>
      <span class="price">${buka ? 'BUKA' : 'TUTUP'}</span>
    </button>`;
  });
  while (tiles.length < 9) {
    tiles.push('<div class="tile empty"><span class="emoji">✨</span><span class="name">Segera hadir</span></div>');
  }
  return `<div class="stage">
    <section class="panel board">
      <div class="badge">Pesan<br>Hari<br>Ini!</div>
      <div class="board-top"><div class="logo-sign">BU RINA<small>KANTIN</small></div></div>
      <div class="grid g3">${tiles.join('')}</div>
      <p style="color:#fff;text-align:center;margin:16px 0 0;font-size:18px">Pilih kantin untuk mulai memesan</p>
    </section>
    <aside class="side">
      <div class="top-actions"><a class="round-btn" href="kasir.html" title="Halaman kasir">🔑</a></div>
      <button class="ticket" data-act="open-cart">🛒 Keranjang${cartCount() ? `<span class="pill">${cartCount()}</span>` : ''}</button>
      <button class="ticket t2" data-act="open-queue">🎫 Antrean Saya${state.activeCount ? `<span class="pill">${state.activeCount}</span>` : ''}</button>
      <button class="ticket t3" data-act="open-history">📜 Riwayat</button>
    </aside>
  </div>`;
}

/* ---------- Tampilan: Menu kantin ---------- */
function menuHTML() {
  const k = state.current;
  const qtyByMenu = {};
  state.cart.forEach((l) => { qtyByMenu[l.menu_id] = (qtyByMenu[l.menu_id] || 0) + l.jumlah; });

  const tiles = state.menu.map((m) => {
    const ada = Number(m.tersedia) === 1;
    return `<button class="tile dark ${ada ? '' : 'soldout'}" ${ada ? '' : 'disabled'} data-act="detail" data-id="${m.id}">
      ${qtyByMenu[m.id] ? `<span class="qty-pill">${qtyByMenu[m.id]}</span>` : ''}
      <span class="emoji">${esc(m.emoji)}</span>
      <span class="name">${esc(m.nama)}</span>
      <span class="price">${rp(m.harga)}</span>
    </button>`;
  });
  while (tiles.length < 12) tiles.push('<div class="tile dark" style="opacity:.3;box-shadow:none"></div>');

  const slotCount = Math.max(9, Math.ceil(state.cart.length / 3) * 3);
  const slots = [];
  for (let i = 0; i < slotCount; i++) {
    const l = state.cart[i];
    slots.push(l
      ? `<button class="slot filled" data-act="open-cart" title="${esc(l.nama)}">${esc(l.emoji)}<b>${l.jumlah}</b></button>`
      : '<div class="slot">✕</div>');
  }

  return `<div class="stage layout-menu">
    <section class="panel">
      <div class="titlebar"><span>${esc(k.emoji)} ${esc(k.nama)}</span><span class="count">${state.menu.length} menu</span></div>
      <div class="dark-grid"><div class="grid g4">${tiles.join('')}</div></div>
    </section>
    <aside class="side">
      <div class="top-actions">
        <button class="round-btn" data-act="back" title="Kembali">↩</button>
        <button class="round-btn" data-act="open-queue" title="Antrean saya">🎫</button>
      </div>
      <div class="cart-panel" style="margin-top:14px">
        <div class="cart-tab">Keranjang</div>
        <div class="slots">${slots.join('')}</div>
        <div class="cart-total"><span>Total</span><span>${rp(cartTotal())}</span></div>
        <button class="cta" data-act="open-cart" ${state.cart.length ? '' : 'disabled'}>Checkout</button>
      </div>
    </aside>
  </div>`;
}

function render() {
  $('#app').innerHTML = state.view === 'menu' && state.current ? menuHTML() : homeHTML();
}

/* ---------- Detail menu (jumlah, topping, catatan) ---------- */
function openDetail(id) {
  const m = state.menu.find((x) => Number(x.id) === Number(id));
  if (!m) return;
  state.detail = { menu: m, qty: 1 };
  state.modal = 'detail';

  const groups = m.grup.map((g) => {
    const wajib = Number(g.wajib) === 1;
    const max = Number(g.maks_pilihan);
    const rows = g.opsi.map((o, i) => `<label class="opt-row">
        <input type="checkbox" data-g="${g.id}" data-nama="${esc(o.nama)}" data-price="${o.harga_tambahan}" value="${o.id}" ${wajib && max === 1 && i === 0 ? 'checked' : ''}>
        <span>${esc(o.nama)}</span>${Number(o.harga_tambahan) > 0 ? `<span class="plus">+${rp(o.harga_tambahan)}</span>` : ''}
      </label>`).join('');
    return `<div class="group" data-max="${max}" data-wajib="${wajib ? 1 : 0}" data-name="${esc(g.nama)}">
      <h4>${esc(g.nama)}<span class="tag ${wajib ? '' : 'opt'}">${wajib ? 'Wajib' : 'Opsional'}${max > 1 ? ' · maks ' + max : ''}</span></h4>${rows}
    </div>`;
  }).join('');

  openModal(`${CLOSE_BTN}
    <h2 style="padding-right:50px">${esc(m.nama)}</h2>
    <div class="muted">${rp(m.harga)}</div>
    <div class="hero-emoji">${esc(m.emoji)}</div>
    ${groups}
    <label class="lbl" for="d-note">Catatan untuk penjual</label>
    <textarea id="d-note" maxlength="200" placeholder="Contoh: jangan pakai bawang, sambal dipisah"></textarea>
    <div class="row" style="margin:14px 0">
      <span style="font-size:18px">Jumlah</span>
      <div class="stepper"><button data-act="d-minus">−</button><span id="d-qty">1</span><button data-act="d-plus">+</button></div>
    </div>
    <button class="cta" id="d-add" data-act="d-add"></button>`);
  refreshDetail();
}

function detailTotal() {
  let extra = 0;
  document.querySelectorAll('.modal input[data-g]:checked').forEach((i) => { extra += Number(i.dataset.price); });
  return (Number(state.detail.menu.harga) + extra) * state.detail.qty;
}
function refreshDetail() {
  if (!state.detail) return;
  $('#d-qty').textContent = state.detail.qty;
  $('#d-add').textContent = 'Tambah ke keranjang • ' + rp(detailTotal());
}

function addToCart() {
  const { menu, qty } = state.detail;
  const opsi = [];
  let ok = true;
  document.querySelectorAll('.modal .group').forEach((g) => {
    const picked = [...g.querySelectorAll('input[data-g]:checked')];
    if (g.dataset.wajib === '1' && picked.length < 1) { ok = false; toast(`Pilih "${g.dataset.name}" dulu`); }
    picked.forEach((p) => opsi.push({ id: Number(p.value), nama: p.dataset.nama, tambah: Number(p.dataset.price) }));
  });
  if (!ok) return;

  const catatan = $('#d-note').value.trim();
  const key = `${menu.id}|${opsi.map((o) => o.id).sort((a, b) => a - b).join(',')}|${catatan}`;
  const ada = state.cart.find((l) => l.key === key);
  if (ada) ada.jumlah = Math.min(50, ada.jumlah + qty);
  else state.cart.push({ key, menu_id: Number(menu.id), nama: menu.nama, emoji: menu.emoji, harga: Number(menu.harga), jumlah: qty, catatan, opsi });

  state.cartKantin = state.current.id;
  saveCart();
  closeModal();
  render();
  toast('Masuk keranjang 🛒');
}

/* ---------- Keranjang / Checkout ---------- */
function checkoutHTML() {
  if (!state.cart.length) {
    return `${CLOSE_BTN}<h2>Keranjang</h2><p class="muted" style="font-size:16px">Keranjang masih kosong. Pilih menu dulu, ya!</p>`;
  }
  const lines = state.cart.map((l, i) => `<div class="cart-line">
      <div class="e">${esc(l.emoji)}</div>
      <div>${esc(l.nama)}
        <small>${l.opsi.length ? esc(l.opsi.map((o) => o.nama).join(', ')) : 'Tanpa tambahan'}${l.catatan ? ' · 📝 ' + esc(l.catatan) : ''}</small>
        <small>${rp(lineUnit(l))} × ${l.jumlah} = ${rp(lineUnit(l) * l.jumlah)}</small>
      </div>
      <div class="stepper"><button data-act="c-minus" data-i="${i}">−</button><span>${l.jumlah}</span><button data-act="c-plus" data-i="${i}">+</button></div>
    </div>`).join('');
  const kantin = state.kantin.find((k) => Number(k.id) === Number(state.cartKantin));
  const d = state.draft;
  return `${CLOSE_BTN}
    <h2 style="padding-right:50px">Checkout</h2>
    <div class="muted">${kantin ? esc(kantin.emoji + ' ' + kantin.nama) : ''}</div>
    <div class="group" style="margin-top:12px">${lines}</div>
    <label class="lbl" for="c-nama">Nama pemesan</label>
    <input type="text" id="c-nama" maxlength="60" placeholder="Nama kamu" value="${esc(d.nama)}">
    <label class="lbl" for="c-note">Catatan pesanan (opsional)</label>
    <textarea id="c-note" maxlength="200" placeholder="Contoh: ambil jam istirahat kedua">${esc(d.catatan)}</textarea>
    <label class="lbl" for="c-metode">Cara bayar</label>
    <select id="c-metode">
      <option value="tunai" ${d.metode === 'tunai' ? 'selected' : ''}>Tunai di kasir</option>
      <option value="transfer" ${d.metode === 'transfer' ? 'selected' : ''}>Transfer (tunjukkan bukti ke kasir)</option>
      <option value="qris" ${d.metode === 'qris' ? 'selected' : ''}>QRIS di kasir</option>
    </select>
    <div class="row" style="margin:16px 0;font-size:22px"><span>Total</span><span style="color:var(--red)">${rp(cartTotal())}</span></div>
    <button class="cta" data-act="c-submit">Pesan Sekarang</button>`;
}
function openCheckout() { state.modal = 'checkout'; openModal(checkoutHTML()); }

async function submitOrder(btn) {
  const nama = state.draft.nama.trim();
  if (!nama) { toast('Isi nama pemesan dulu'); $('#c-nama')?.focus(); return; }
  btn.disabled = true;
  btn.textContent = 'Mengirim…';
  try {
    const res = await api('order.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kantin_id: state.cartKantin,
        nama,
        catatan: state.draft.catatan,
        metode_bayar: state.draft.metode,
        items: state.cart.map((l) => ({ menu_id: l.menu_id, jumlah: l.jumlah, catatan: l.catatan, opsi_ids: l.opsi.map((o) => o.id) })),
      }),
    });
    save('nama', nama);
    state.orders.unshift(res.id);
    state.orders = state.orders.slice(0, 30);
    save('orders', state.orders);
    state.cart = []; state.cartKantin = null; state.draft.catatan = '';
    saveCart();
    showTicket(res);
    pollOrders();
    render();
  } catch (err) {
    toast(err.message);
    btn.disabled = false;
    btn.textContent = 'Pesan Sekarang';
    if (state.current) { try { state.menu = await api('menu.php?kantin_id=' + state.current.id); render(); } catch { /* abaikan */ } }
  }
}

function showTicket(res) {
  state.modal = 'ticket';
  openModal(`<div class="ticket-big">
    <h2>Pesanan masuk! 🎉</h2>
    <p class="muted" style="font-size:15px">Nomor antreanmu</p>
    <div class="no">#${pad(res.nomor_antrean)}</div>
    <p style="font-size:20px;margin:8px 0">Total ${rp(res.total)}</p>
    <p class="muted" style="font-size:14px">Silakan bayar di kasir. Layar akan memberi tahu saat pesananmu siap.</p>
    <button class="cta" data-act="open-queue" style="margin-top:10px">Pantau Antrean</button>
  </div>`);
}

/* ---------- Antrean & Riwayat ---------- */
const AKTIF = ['baru', 'diproses', 'siap'];

function orderCard(o) {
  const idx = { baru: 0, diproses: 1, siap: 2, selesai: 3 }[o.status];
  const labels = ['Diterima', 'Diproses', 'Siap', 'Selesai'];
  const steps = o.status === 'batal'
    ? '<div class="step" style="background:#ffd6dd;color:#a1122c;font-size:14px">Pesanan dibatalkan</div>'
    : `<div class="steps">${labels.map((l, i) => `<div class="step ${i < idx || o.status === 'selesai' ? 'done' : i === idx ? 'now' : ''}">${l}</div>`).join('')}</div>`;
  let info = '';
  if (o.status === 'siap') info = `<b style="color:#0b6b47">Pesananmu siap! Ambil di ${esc(o.kantin)}.</b>`;
  else if (o.status === 'baru' || o.status === 'diproses') info = o.didepan > 0 ? `${o.didepan} pesanan di depanmu` : 'Giliranmu sebentar lagi';
  const items = o.items.map((it) => `<div class="muted" style="font-size:13px">${it.jumlah}× ${esc(it.nama_menu)}${it.opsi.length ? ' (' + esc(it.opsi.map((x) => x.nama_opsi).join(', ')) + ')' : ''}${it.catatan ? ' · 📝 ' + esc(it.catatan) : ''}</div>`).join('');
  return `<div class="order-card">
    <div class="row"><div><div class="muted">${esc(o.kantin)} · ${esc(String(o.dibuat_pada).slice(11, 16))}</div><div class="no">#${pad(o.nomor_antrean)}</div></div>
      <div style="text-align:right;font-size:20px">${rp(o.total)}</div></div>
    ${steps}
    <div style="margin:6px 0;font-size:16px">${info}</div>
    ${items}
  </div>`;
}

function noteStatuses(list) {
  list.forEach((o) => {
    const before = state.statusMap[o.id];
    if (before && before !== o.status && o.status === 'siap') {
      toast(`Pesanan #${pad(o.nomor_antrean)} siap diambil! 🎉`);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
    state.statusMap[o.id] = o.status;
  });
  const n = list.filter((o) => AKTIF.includes(o.status)).length;
  const changed = n !== state.activeCount;
  state.activeCount = n;
  return changed;
}

async function openOrders(mode) {
  state.modal = mode;
  openModal(`${CLOSE_BTN}<h2 style="padding-right:50px">${mode === 'queue' ? 'Antrean Saya' : 'Riwayat Pesanan'}</h2><div id="orders-box" class="muted" style="font-size:15px">Memuat…</div>`);
  await refreshOrders();
}

async function refreshOrders() {
  if (state.modal !== 'queue' && state.modal !== 'history') return;
  if (!state.orders.length) { const b = $('#orders-box'); if (b) b.textContent = 'Belum ada pesanan.'; return; }
  try {
    const list = await api('order.php?ids=' + state.orders.join(','));
    noteStatuses(list);
    const box = $('#orders-box');
    if (!box) return;
    const show = state.modal === 'queue' ? list.filter((o) => AKTIF.includes(o.status)) : list;
    box.innerHTML = show.length ? show.map(orderCard).join('') : 'Tidak ada pesanan aktif. Yuk pesan sesuatu!';
  } catch (err) {
    const box = $('#orders-box');
    if (box) box.textContent = err.message;
  }
}

async function pollOrders() {
  if (!state.orders.length) return;
  if (state.modal === 'queue' || state.modal === 'history') return refreshOrders();
  try {
    const list = await api('order.php?ids=' + state.orders.join(','));
    const changed = noteStatuses(list);
    if (changed && !state.modal) render();
  } catch { /* diam saja, coba lagi nanti */ }
}

/* ---------- Event ---------- */
document.addEventListener('click', async (e) => {
  if (e.target.matches('[data-overlay]')) return closeModal();
  const el = e.target.closest('[data-act]');
  if (!el) return;

  switch (el.dataset.act) {
    case 'pick-kantin': {
      const k = state.kantin.find((x) => Number(x.id) === Number(el.dataset.id));
      if (!k) return;
      if (state.cart.length && state.cartKantin && Number(state.cartKantin) !== Number(k.id)) {
        if (!confirm('Keranjang dari kantin lain akan dikosongkan. Lanjut?')) return;
        state.cart = []; state.cartKantin = null; saveCart();
      }
      try {
        state.menu = await api('menu.php?kantin_id=' + k.id);
        state.current = k; state.view = 'menu';
        render(); window.scrollTo(0, 0);
      } catch (err) { toast(err.message); }
      break;
    }
    case 'back': state.view = 'home'; render(); break;
    case 'close': closeModal(); break;
    case 'detail': openDetail(el.dataset.id); break;
    case 'd-minus': if (state.detail.qty > 1) { state.detail.qty--; refreshDetail(); } break;
    case 'd-plus': if (state.detail.qty < 20) { state.detail.qty++; refreshDetail(); } break;
    case 'd-add': addToCart(); break;
    case 'open-cart':
      if (!state.cart.length) toast('Keranjang masih kosong');
      else openCheckout();
      break;
    case 'c-minus':
    case 'c-plus': {
      const l = state.cart[Number(el.dataset.i)];
      if (!l) return;
      l.jumlah += el.dataset.act === 'c-plus' ? 1 : -1;
      if (l.jumlah < 1) state.cart.splice(Number(el.dataset.i), 1);
      if (l.jumlah > 50) l.jumlah = 50;
      if (!state.cart.length) state.cartKantin = null;
      saveCart();
      setModalHTML(checkoutHTML());
      render();
      break;
    }
    case 'c-submit': submitOrder(el); break;
    case 'open-queue': openOrders('queue'); break;
    case 'open-history': openOrders('history'); break;
  }
});

// Batas pilihan topping + perilaku "pilih satu"
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'c-metode') state.draft.metode = t.value;
  if (!t.matches('input[data-g]')) return;
  const grp = t.closest('.group');
  const max = Number(grp.dataset.max);
  const wajib = grp.dataset.wajib === '1';
  const boxes = [...grp.querySelectorAll('input[data-g]')];
  if (max === 1) {
    if (t.checked) boxes.forEach((b) => { if (b !== t) b.checked = false; });
    else if (wajib) t.checked = true;
  } else if (boxes.filter((b) => b.checked).length > max) {
    t.checked = false;
    toast(`Maksimal ${max} pilihan`);
  }
  refreshDetail();
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'c-nama') state.draft.nama = e.target.value;
  if (e.target.id === 'c-note') state.draft.catatan = e.target.value;
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

/* ---------- Mulai ---------- */
async function init() {
  $('#app').innerHTML = '<p style="color:#fff;text-align:center;padding:70px 16px;font-size:26px">Memuat kantin…</p>';
  try {
    state.kantin = await api('kantin.php');
    render();
  } catch (err) {
    $('#app').innerHTML = `<div class="stage" style="grid-template-columns:1fr"><div class="panel"><h2>Ups!</h2><p style="font-size:18px">${esc(err.message)}</p><button class="cta" onclick="location.reload()">Coba lagi</button></div></div>`;
    return;
  }
  pollOrders();
  setInterval(pollOrders, 8000);
}
init();
