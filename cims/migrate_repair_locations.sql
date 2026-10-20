USE `cims_db`;

ALTER TABLE `repair_tickets`
  ADD COLUMN `warranty_days` int DEFAULT NULL AFTER `assigned_to`,
  ADD COLUMN `warranty_start_date` date DEFAULT NULL AFTER `assigned_to`,
  ADD COLUMN `warranty_end_date` date DEFAULT NULL AFTER `warranty_start_date`,
  ADD COLUMN `customer_address` varchar(255) DEFAULT NULL AFTER `assigned_to`,
  ADD COLUMN `latitude` decimal(10,8) DEFAULT NULL AFTER `customer_address`,
  ADD COLUMN `longitude` decimal(11,8) DEFAULT NULL AFTER `latitude`,
  ADD INDEX `idx_repair_coordinates` (`latitude`, `longitude`);

ALTER TABLE `transactions`
  ADD COLUMN `branch` varchar(100) DEFAULT NULL AFTER `change_amount`,
  ADD COLUMN `customer_location` varchar(255) DEFAULT NULL AFTER `branch`,
  ADD INDEX `idx_transaction_coordinates` (`latitude`, `longitude`);

ALTER TABLE `transaction_items`
  ADD COLUMN `warranty_days` int DEFAULT NULL AFTER `subtotal`;