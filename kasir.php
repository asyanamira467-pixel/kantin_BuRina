<?php
require __DIR__ . '/config.php';

// Semua endpoint kasir wajib PIN (header X-Kasir-Pin)
require_kasir();

$pdo = db();
$aksi = $_GET['aksi'] ?? '';
$kantinId = (int)($_GET['kantin_id'] ?? 0);

// GET kasir.php?aksi=pesanan&kantin_id=1 -> pesanan hari ini
if ($aksi === 'pesanan') {
    $st = $pdo->prepare(
        "SELECT id, nomor_antrean, nama_pemesan, catatan, total, status, metode_bayar, dibuat_pada
         FROM pesanan WHERE kantin_id = ? AND DATE(dibuat_pada) = CURDATE() ORDER BY nomor_antrean"
    );
    $st->execute([$kantinId]);
    $orders = $st->fetchAll();

    $stItems = $pdo->prepare('SELECT id, nama_menu, emoji, jumlah, catatan FROM item_pesanan WHERE pesanan_id = ?');
    $stOpsi = $pdo->prepare('SELECT nama_opsi FROM item_opsi WHERE item_id = ?');
    foreach ($orders as &$o) {
        $stItems->execute([$o['id']]);
        $items = $stItems->fetchAll();
        foreach ($items as &$it) {
            $stOpsi->execute([$it['id']]);
            $it['opsi'] = array_column($stOpsi->fetchAll(), 'nama_opsi');
        }
        unset($it);
        $o['items'] = $items;
    }
    unset($o);
    json_out($orders);
}

// POST kasir.php?aksi=status  {id, status}
if ($aksi === 'status' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $in = body();
    $status = $in['status'] ?? '';
    if (!in_array($status, ['baru', 'diproses', 'siap', 'selesai', 'batal'], true)) json_out(['error' => 'Status tidak valid'], 400);
    $pdo->prepare('UPDATE pesanan SET status = ? WHERE id = ?')->execute([$status, (int)($in['id'] ?? 0)]);
    json_out(['ok' => true]);
}

// GET kasir.php?aksi=menu&kantin_id=1 -> semua menu (termasuk yang habis)
if ($aksi === 'menu') {
    $st = $pdo->prepare('SELECT id, nama, harga, emoji, tersedia FROM menu WHERE kantin_id = ? ORDER BY id');
    $st->execute([$kantinId]);
    json_out($st->fetchAll());
}

// POST kasir.php?aksi=tersedia  {id, tersedia}
if ($aksi === 'tersedia' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $in = body();
    $pdo->prepare('UPDATE menu SET tersedia = ? WHERE id = ?')->execute([empty($in['tersedia']) ? 0 : 1, (int)($in['id'] ?? 0)]);
    json_out(['ok' => true]);
}

// GET kasir.php?aksi=rekap&kantin_id=1 -> ringkasan penjualan hari ini
if ($aksi === 'rekap') {
    $st = $pdo->prepare(
        "SELECT COUNT(*) AS jumlah_pesanan,
                COALESCE(SUM(CASE WHEN status <> 'batal' THEN total END), 0) AS omzet,
                COALESCE(SUM(status = 'selesai'), 0) AS selesai,
                COALESCE(SUM(status IN ('baru','diproses','siap')), 0) AS aktif
         FROM pesanan WHERE kantin_id = ? AND DATE(dibuat_pada) = CURDATE()"
    );
    $st->execute([$kantinId]);
    $rekap = $st->fetch();

    $st = $pdo->prepare(
        "SELECT i.nama_menu, SUM(i.jumlah) AS terjual
         FROM item_pesanan i JOIN pesanan p ON p.id = i.pesanan_id
         WHERE p.kantin_id = ? AND DATE(p.dibuat_pada) = CURDATE() AND p.status <> 'batal'
         GROUP BY i.nama_menu ORDER BY terjual DESC LIMIT 5"
    );
    $st->execute([$kantinId]);
    $rekap['terlaris'] = $st->fetchAll();
    json_out($rekap);
}

json_out(['error' => 'Aksi tidak dikenal'], 400);
