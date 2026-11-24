<?php
require __DIR__ . '/config.php';

$rows = db()->query('SELECT id, nama, emoji, warna, buka FROM kantin ORDER BY id')->fetchAll();
json_out($rows);
