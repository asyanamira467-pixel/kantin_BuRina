<?php
// Pengaturan koneksi database (XAMPP default: user root, password kosong)
const DB_HOST = 'localhost';
const DB_NAME = 'kantin_bu_rina';
const DB_USER = 'root';
const DB_PASS = '';

// PIN sederhana untuk halaman kasir. GANTI sebelum dipakai sungguhan.
const KASIR_PIN = '1234';

header('Content-Type: application/json; charset=utf-8');

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
    }
    return $pdo;
}

function json_out($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function body(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '[]', true);
    return is_array($data) ? $data : [];
}

function require_kasir(): void {
    $pin = $_SERVER['HTTP_X_KASIR_PIN'] ?? '';
    if (!hash_equals(KASIR_PIN, (string)$pin)) {
        json_out(['error' => 'PIN salah'], 401);
    }
}

set_exception_handler(function (Throwable $e) {
    json_out(['error' => 'Terjadi kesalahan server: ' . $e->getMessage()], 500);
});
