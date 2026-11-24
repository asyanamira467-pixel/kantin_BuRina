<?php
require __DIR__ . '/config.php';

$pdo = db();

// ---------- GET order.php?ids=1,2,3 : status pesanan milik pembeli ----------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $ids = array_values(array_filter(array_map('intval', explode(',', $_GET['ids'] ?? '')), fn($v) => $v > 0));
    $ids = array_slice($ids, 0, 50);
    if (!$ids) json_out([]);

    $in = implode(',', array_fill(0, count($ids), '?'));
    $st = $pdo->prepare(
        "SELECT p.id, p.kantin_id, k.nama AS kantin, p.nomor_antrean, p.nama_pemesan, p.catatan,
                p.total, p.status, p.metode_bayar, p.dibuat_pada
         FROM pesanan p JOIN kantin k ON k.id = p.kantin_id
         WHERE p.id IN ($in) ORDER BY p.id DESC"
    );
    $st->execute($ids);
    $orders = $st->fetchAll();

    $stItems = $pdo->prepare('SELECT id, nama_menu, emoji, jumlah, harga_satuan, catatan FROM item_pesanan WHERE pesanan_id = ?');
    $stOpsi = $pdo->prepare('SELECT nama_opsi, harga_tambahan FROM item_opsi WHERE item_id = ?');
    $stAhead = $pdo->prepare(
        "SELECT COUNT(*) FROM pesanan
         WHERE kantin_id = ? AND DATE(dibuat_pada) = DATE(?) AND nomor_antrean < ?
           AND status IN ('baru','diproses')"
    );

    foreach ($orders as &$o) {
        $stItems->execute([$o['id']]);
        $items = $stItems->fetchAll();
        foreach ($items as &$it) {
            $stOpsi->execute([$it['id']]);
            $it['opsi'] = $stOpsi->fetchAll();
        }
        unset($it);
        $o['items'] = $items;

        $stAhead->execute([$o['kantin_id'], $o['dibuat_pada'], $o['nomor_antrean']]);
        $o['didepan'] = in_array($o['status'], ['baru', 'diproses'], true) ? (int)$stAhead->fetchColumn() : 0;
    }
    unset($o);
    json_out($orders);
}

// ---------- POST order.php : buat pesanan baru ----------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'Metode tidak didukung'], 405);

$in = body();
$kantinId = (int)($in['kantin_id'] ?? 0);
$nama = trim((string)($in['nama'] ?? ''));
$catatan = trim((string)($in['catatan'] ?? ''));
$metode = in_array($in['metode_bayar'] ?? '', ['tunai', 'transfer', 'qris'], true) ? $in['metode_bayar'] : 'tunai';
$items = $in['items'] ?? [];

if ($kantinId <= 0) json_out(['error' => 'Kantin tidak valid'], 400);
if ($nama === '' || mb_strlen($nama) > 60) json_out(['error' => 'Isi nama pemesan (maks. 60 huruf)'], 400);
if (!is_array($items) || !$items || count($items) > 30) json_out(['error' => 'Keranjang kosong'], 400);

$stKantin = $pdo->prepare('SELECT buka FROM kantin WHERE id = ?');
$stKantin->execute([$kantinId]);
$kantin = $stKantin->fetch();
if (!$kantin || !$kantin['buka']) json_out(['error' => 'Kantin sedang tutup'], 400);

$stMenu = $pdo->prepare('SELECT id, nama, harga, emoji FROM menu WHERE id = ? AND kantin_id = ? AND tersedia = 1');
$stGrup = $pdo->prepare('SELECT id, nama, wajib, maks_pilihan FROM grup_opsi WHERE menu_id = ?');
$stOpsi = $pdo->prepare('SELECT id, nama, harga_tambahan FROM opsi WHERE grup_id = ?');

// Harga SELALU dihitung ulang di server, bukan dipercaya dari browser.
$lines = [];
$total = 0;
foreach ($items as $it) {
    $menuId = (int)($it['menu_id'] ?? 0);
    $jumlah = (int)($it['jumlah'] ?? 0);
    $noteItem = mb_substr(trim((string)($it['catatan'] ?? '')), 0, 255);
    $pilih = array_map('intval', is_array($it['opsi_ids'] ?? null) ? $it['opsi_ids'] : []);
    if ($jumlah < 1 || $jumlah > 50) json_out(['error' => 'Jumlah tidak valid'], 400);

    $stMenu->execute([$menuId, $kantinId]);
    $menu = $stMenu->fetch();
    if (!$menu) json_out(['error' => 'Ada menu yang sudah habis atau tidak ditemukan'], 400);

    $stGrup->execute([$menuId]);
    $chosen = [];
    foreach ($stGrup->fetchAll() as $g) {
        $stOpsi->execute([$g['id']]);
        $picked = array_values(array_filter($stOpsi->fetchAll(), fn($o) => in_array((int)$o['id'], $pilih, true)));
        if ($g['wajib'] && count($picked) < 1) {
            json_out(['error' => "Pilih \"{$g['nama']}\" untuk {$menu['nama']}"], 400);
        }
        if (count($picked) > (int)$g['maks_pilihan']) {
            json_out(['error' => "\"{$g['nama']}\" maksimal {$g['maks_pilihan']} pilihan"], 400);
        }
        foreach ($picked as $p) $chosen[] = $p;
    }

    $harga = (int)$menu['harga'];
    foreach ($chosen as $c) $harga += (int)$c['harga_tambahan'];
    $total += $harga * $jumlah;
    $lines[] = ['menu' => $menu, 'jumlah' => $jumlah, 'harga' => $harga, 'catatan' => $noteItem, 'opsi' => $chosen];
}

$pdo->beginTransaction();
try {
    // Nomor antrean urut per kantin, mulai dari 1 tiap hari
    $stNo = $pdo->prepare('SELECT COALESCE(MAX(nomor_antrean), 0) + 1 FROM pesanan WHERE kantin_id = ? AND DATE(dibuat_pada) = CURDATE() FOR UPDATE');
    $stNo->execute([$kantinId]);
    $nomor = (int)$stNo->fetchColumn();

    $pdo->prepare('INSERT INTO pesanan (kantin_id, nomor_antrean, nama_pemesan, catatan, total, metode_bayar) VALUES (?,?,?,?,?,?)')
        ->execute([$kantinId, $nomor, $nama, mb_substr($catatan, 0, 255), $total, $metode]);
    $pesananId = (int)$pdo->lastInsertId();

    $insItem = $pdo->prepare('INSERT INTO item_pesanan (pesanan_id, menu_id, nama_menu, emoji, jumlah, harga_satuan, catatan) VALUES (?,?,?,?,?,?,?)');
    $insOpsi = $pdo->prepare('INSERT INTO item_opsi (item_id, nama_opsi, harga_tambahan) VALUES (?,?,?)');
    foreach ($lines as $l) {
        $insItem->execute([$pesananId, $l['menu']['id'], $l['menu']['nama'], $l['menu']['emoji'], $l['jumlah'], $l['harga'], $l['catatan']]);
        $itemId = (int)$pdo->lastInsertId();
        foreach ($l['opsi'] as $o) $insOpsi->execute([$itemId, $o['nama'], $o['harga_tambahan']]);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

json_out(['id' => $pesananId, 'nomor_antrean' => $nomor, 'total' => $total], 201);
