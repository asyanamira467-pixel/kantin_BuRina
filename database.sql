-- Database Kantin Bu Rina (MySQL / MariaDB, XAMPP)
-- Import lewat phpMyAdmin (tab Import) atau cmd:
--   C:\xampp\mysql\bin\mysql -u root < database.sql

DROP DATABASE IF EXISTS kantin_bu_rina;
CREATE DATABASE kantin_bu_rina CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kantin_bu_rina;

CREATE TABLE kantin (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(60) NOT NULL,
  emoji VARCHAR(8) NOT NULL DEFAULT '🍽️',
  warna VARCHAR(9) NOT NULL DEFAULT '#e8294b',
  buka TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE menu (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kantin_id INT NOT NULL,
  nama VARCHAR(80) NOT NULL,
  harga INT NOT NULL,
  emoji VARCHAR(8) NOT NULL DEFAULT '🍴',
  tersedia TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (kantin_id) REFERENCES kantin(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Grup pilihan per menu, mis. "Topping" (boleh banyak) atau "Level Pedas" (pilih 1)
CREATE TABLE grup_opsi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_id INT NOT NULL,
  nama VARCHAR(60) NOT NULL,
  wajib TINYINT(1) NOT NULL DEFAULT 0,
  maks_pilihan INT NOT NULL DEFAULT 1,
  FOREIGN KEY (menu_id) REFERENCES menu(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE opsi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  grup_id INT NOT NULL,
  nama VARCHAR(60) NOT NULL,
  harga_tambahan INT NOT NULL DEFAULT 0,
  FOREIGN KEY (grup_id) REFERENCES grup_opsi(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE pesanan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kantin_id INT NOT NULL,
  nomor_antrean INT NOT NULL,
  nama_pemesan VARCHAR(60) NOT NULL,
  catatan VARCHAR(255) NOT NULL DEFAULT '',
  total INT NOT NULL,
  status ENUM('baru','diproses','siap','selesai','batal') NOT NULL DEFAULT 'baru',
  metode_bayar VARCHAR(20) NOT NULL DEFAULT 'tunai',
  dibuat_pada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (kantin_id, dibuat_pada),
  FOREIGN KEY (kantin_id) REFERENCES kantin(id)
) ENGINE=InnoDB;

-- Nama dan harga disalin saat pesan, supaya riwayat tidak berubah kalau menu diedit
CREATE TABLE item_pesanan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pesanan_id INT NOT NULL,
  menu_id INT NULL,
  nama_menu VARCHAR(80) NOT NULL,
  emoji VARCHAR(8) NOT NULL DEFAULT '🍴',
  jumlah INT NOT NULL,
  harga_satuan INT NOT NULL,
  catatan VARCHAR(255) NOT NULL DEFAULT '',
  FOREIGN KEY (pesanan_id) REFERENCES pesanan(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE item_opsi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  nama_opsi VARCHAR(60) NOT NULL,
  harga_tambahan INT NOT NULL DEFAULT 0,
  FOREIGN KEY (item_id) REFERENCES item_pesanan(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ===== DATA CONTOH =====
INSERT INTO kantin (id, nama, emoji, warna) VALUES
 (1, 'Kantin Bu Rina', '🍛', '#e8294b'),
 (2, 'Kantin Bakso Pak Joko', '🍜', '#f59e0b'),
 (3, 'Kantin Minuman Segar', '🧋', '#10b981');

INSERT INTO menu (id, kantin_id, nama, harga, emoji, tersedia) VALUES
 (1, 1, 'Nasi Goreng', 15000, '🍳', 1),
 (2, 1, 'Mie Goreng', 14000, '🍝', 1),
 (3, 1, 'Ayam Geprek', 17000, '🍗', 1),
 (4, 1, 'Nasi Ayam Bakar', 20000, '🍖', 1),
 (5, 1, 'Soto Ayam', 16000, '🍲', 1),
 (6, 1, 'Gado-gado', 13000, '🥗', 1),
 (7, 1, 'Es Teh Manis', 4000, '🧊', 1),
 (8, 1, 'Es Jeruk', 6000, '🍊', 0),
 (9, 2, 'Bakso Urat', 15000, '🍜', 1),
 (10, 2, 'Bakso Telur', 17000, '🥚', 1),
 (11, 2, 'Mie Ayam', 14000, '🍜', 1),
 (12, 2, 'Pangsit Goreng', 8000, '🥟', 1),
 (13, 3, 'Boba Brown Sugar', 18000, '🧋', 1),
 (14, 3, 'Jus Alpukat', 15000, '🥑', 1),
 (15, 3, 'Kopi Susu', 12000, '☕', 1);

INSERT INTO grup_opsi (id, menu_id, nama, wajib, maks_pilihan) VALUES
 (1, 1, 'Topping', 0, 3),
 (2, 1, 'Level Pedas', 1, 1),
 (3, 2, 'Topping', 0, 3),
 (4, 3, 'Level Pedas', 1, 1),
 (5, 3, 'Tambahan', 0, 2),
 (6, 7, 'Es / Hangat', 1, 1),
 (7, 9, 'Tambahan', 0, 3),
 (8, 11, 'Tambahan', 0, 3),
 (9, 13, 'Topping', 0, 2),
 (10, 13, 'Level Manis', 1, 1),
 (11, 15, 'Ukuran', 1, 1);

INSERT INTO opsi (grup_id, nama, harga_tambahan) VALUES
 (1, 'Telur Ceplok', 4000), (1, 'Sosis', 3000), (1, 'Kerupuk', 2000),
 (2, 'Tidak Pedas', 0), (2, 'Sedang', 0), (2, 'Pedas', 0),
 (3, 'Telur Ceplok', 4000), (3, 'Sosis', 3000), (3, 'Kerupuk', 2000),
 (4, 'Tidak Pedas', 0), (4, 'Sedang', 0), (4, 'Pedas', 0),
 (5, 'Nasi Tambah', 4000), (5, 'Tempe', 2000),
 (6, 'Es', 0), (6, 'Hangat', 0),
 (7, 'Pangsit', 3000), (7, 'Tetelan', 5000), (7, 'Bihun', 2000),
 (8, 'Pangsit', 3000), (8, 'Bakso', 4000), (8, 'Ceker', 3000),
 (9, 'Boba', 3000), (9, 'Cheese Foam', 5000),
 (10, 'Normal', 0), (10, 'Less Sugar', 0),
 (11, 'Regular', 0), (11, 'Large', 4000);
