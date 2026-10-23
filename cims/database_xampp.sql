-- ==========================================================
-- CCAS MOBITRACK (cIMS) MySQL Schema
-- Suitable for quick import in XAMPP phpMyAdmin (MariaDB/MySQL)
-- Database Name: cims_db
-- ==========================================================

CREATE DATABASE IF NOT EXISTS `cims_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `cims_db`;

-- 1. Create PRODUCTS table
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` varchar(50) NOT NULL,
  `barcode` varchar(50) NOT NULL UNIQUE,
  `brand` varchar(100) NOT NULL DEFAULT '',
  `name` varchar(255) NOT NULL,
  `ram` varchar(20) DEFAULT NULL,
  `storage_gb` varchar(20) DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `cost_price` decimal(10,2) DEFAULT NULL,
  `stock` int(11) NOT NULL DEFAULT 0,
  `category` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `warranty_days` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  INDEX `idx_barcode` (`barcode`),
  INDEX `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create CASHIERS Table
DROP TABLE IF EXISTS `cashiers`;
CREATE TABLE `cashiers` (
  `username` varchar(50) NOT NULL,
  `fullName` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL, -- Keep flat or use password_hash() in PHP
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `last_active` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create TRANSACTIONS Table
DROP TABLE IF EXISTS `transactions`;
CREATE TABLE `transactions` (
  `id` varchar(50) NOT NULL,
  `cashier_username` varchar(50) DEFAULT NULL,
  `cashier_name` varchar(100) NOT NULL,
  `discount_percentage` decimal(12,2) NOT NULL DEFAULT 0.00,
  `subtotal` decimal(12,2) NOT NULL,
  `total` decimal(12,2) NOT NULL,
  `payment_received` decimal(12,2) NOT NULL,
  `change_amount` decimal(12,2) NOT NULL,
  `branch` varchar(100) DEFAULT NULL,
  `customer_location` varchar(255) DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  INDEX `idx_transaction_coordinates` (`latitude`, `longitude`),
  CONSTRAINT `fk_transactions_cashier` FOREIGN KEY (`cashier_username`) REFERENCES `cashiers` (`username`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create TRANSACTION_ITEMS Table (Line items)
DROP TABLE IF EXISTS `transaction_items`;
CREATE TABLE `transaction_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `transaction_id` varchar(50) NOT NULL,
  `product_id` varchar(50) DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `cost_price` decimal(10,2) DEFAULT NULL,
  `quantity` int(11) NOT NULL,
  `subtotal` decimal(12,2) NOT NULL,
  `warranty_days` int DEFAULT NULL,
  `warranty_start_date` date DEFAULT NULL,
  `warranty_end_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_items_transaction` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Create REPAIR TICKETS Table
DROP TABLE IF EXISTS `repair_tickets`;
CREATE TABLE `repair_tickets` (
  `id` varchar(50) NOT NULL,
  `customer_name` varchar(100) NOT NULL,
  `contact` varchar(100) NOT NULL,
  `device` varchar(255) NOT NULL,
  `reported_issue` text NOT NULL,
  `status` enum('open','in_progress','completed','closed') NOT NULL DEFAULT 'open',
  `assigned_to` varchar(100) DEFAULT NULL,
  `warranty_days` int DEFAULT NULL,
  `warranty_start_date` date DEFAULT NULL,
  `warranty_end_date` date DEFAULT NULL,
  `customer_address` varchar(255) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NULL DEFAULT NULL,
  `updated_at` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_assigned_to` (`assigned_to`),
  INDEX `idx_repair_coordinates` (`latitude`, `longitude`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Create REPAIR TICKET ITEMS Table
DROP TABLE IF EXISTS `repair_ticket_items`;
CREATE TABLE `repair_ticket_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `repair_ticket_id` varchar(50) NOT NULL,
  `product_id` varchar(50) DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `quantity` int(11) NOT NULL,
  `issue` text DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_repair_ticket` FOREIGN KEY (`repair_ticket_id`) REFERENCES `repair_tickets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_repair_item_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6.5. Create OPERATING EXPENSES table
CREATE TABLE `operating_expenses` (
  `id` varchar(50) NOT NULL,
  `category` varchar(100) NOT NULL,
  `description` varchar(255) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `expense_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  INDEX `idx_operating_expenses_date` (`expense_date`),
  INDEX `idx_operating_expenses_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Create ADMINS Table for administrator credentials
DROP TABLE IF EXISTS `admins`;
CREATE TABLE `admins` (
  `username` varchar(50) NOT NULL,
  `fullName` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Create API_CONFIGURATION Table for external API keys (Geoapify, etc.)
DROP TABLE IF EXISTS `api_configuration`;
CREATE TABLE `api_configuration` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `api_name` varchar(100) NOT NULL UNIQUE,
  `api_key` varchar(255) NOT NULL,
  `base_url` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `description` text DEFAULT NULL,
  `config_data` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  INDEX `idx_api_name` (`api_name`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================================
-- SEED DATA FOR TESTING & DEV
-- ==========================================================

INSERT INTO `admins` (`username`, `fullName`, `password_hash`) VALUES
('admin', 'System Administrator', 'admin123');

-- Geoapify API Configuration (Replace with your actual API key)
INSERT INTO `api_configuration` (`api_name`, `api_key`, `base_url`, `status`, `description`, `config_data`) VALUES
('geoapify', '1436aa49fc86456d832819912f1272eb', 'https://api.geoapify.com', 'active', 'Geoapify location and mapping API', 
  JSON_OBJECT(
    'max_requests_per_day', 3000,
    'location_accuracy', 'high',
    'enable_address_lookup', true,
    'enable_reverse_geocoding', true
  )
);



INSERT INTO `cashiers` (`username`, `fullName`, `password_hash`, `status`, `last_active`) VALUES
('john_cashier', 'John Doe', 'cashier123', 'active', NOW()),
('jane_cashier', 'Jane Smith', 'jane2026', 'active', NOW()),
('test_cashier', 'Test Cashier Quick', '123456', 'active', NOW()),
('jomel', 'Jomel', 'jomel', 'active', NOW());

INSERT INTO `products` (`id`, `barcode`, `name`, `ram`, `storage_gb`, `price`, `stock`, `category`, `description`) VALUES
('prod-1', '841001234567', 'Android Smartphone', '8GB', '128GB', 249.99, 15, 'Samsung', 'Unlocked smartphone with a bright display, dual camera, and long battery life.'),
('prod-2', '400840040182', 'Wireless Bluetooth Headset', NULL, 'N/A', 29.99, 40, 'Accessories', 'Comfortable wireless headset with clear calls and noise reduction.'),
('prod-3', '544900000099', '20W Fast Charging Adapter', NULL, 'N/A', 18.50, 30, 'Accessories', 'Compact fast charger compatible with USB-C phones and tablets.'),
('prod-4', '490243024567', 'USB-C Braided Charging Cable', NULL, 'N/A', 9.99, 75, 'Accessories', 'Durable 1.5-meter cable for charging and data transfer.'),
('prod-5', '690123456789', 'Premium Wireless Optical Mouse', NULL, 'N/A', 19.95, 15, 'Accessories', 'Ergonomic wireless mouse with silent clicks and high precision.'),
('prod-6', '931234567890', 'Mechanical Gaming Keyboard', NULL, 'N/A', 54.99, 12, 'Accessories', 'RGB mechanical keyboard with responsive switches and compact layout.'),
('prod-7', '871234567890', 'Shockproof Phone Case', NULL, 'N/A', 14.50, 50, 'Accessories', 'Protective shockproof case with raised camera and screen edges.'),
('prod-8', '078742351822', '10000mAh Power Bank', NULL, 'N/A', 32.00, 22, 'Accessories', 'Portable power bank with dual USB output and LED battery indicator.');
