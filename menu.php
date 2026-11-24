<?php
require __DIR__ . '/config.php';

// GET menu.php?kantin_id=1  -> daftar menu + grup pilihan (topping, level pedas, dll.)
$kantinId = (int)($_GET['kantin_id'] ?? 0);
if ($kantinId <= 0) json_out(['error' => 'kantin_id wajib'], 400);

$pdo = db();

$st = $pdo->prepare('SELECT id, nama, harga, emoji, tersedia FROM menu WHERE kantin_id = ? ORDER BY tersedia DESC, id');
$st->execute([$kantinId]);
$menus = $st->fetchAll();

$stGrup = $pdo->prepare('SELECT id, nama, wajib, maks_pilihan FROM grup_opsi WHERE menu_id = ? ORDER BY id');
$stOpsi = $pdo->prepare('SELECT id, nama, harga_tambahan FROM opsi WHERE grup_id = ? ORDER BY id');

foreach ($menus as &$m) {
    $stGrup->execute([$m['id']]);
    $grups = $stGrup->fetchAll();
    foreach ($grups as &$g) {
        $stOpsi->execute([$g['id']]);
        $g['opsi'] = $stOpsi->fetchAll();
    }
    unset($g);
    $m['grup'] = $grups;
}
unset($m);

json_out($menus);
