-- Migrate warranty columns from date range to warranty_days
SET FOREIGN_KEY_CHECKS=0;

-- Check if columns exist and modify accordingly
ALTER TABLE `products` DROP COLUMN IF EXISTS `warranty_start_date`;
ALTER TABLE `products` DROP COLUMN IF EXISTS `warranty_end_date`;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `warranty_days` INT(11) DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `brand` VARCHAR(100) NOT NULL DEFAULT '' AFTER `barcode`;
ALTER TABLE `transaction_items` ADD COLUMN IF NOT EXISTS `warranty_start_date` DATE DEFAULT NULL;
ALTER TABLE `transaction_items` ADD COLUMN IF NOT EXISTS `warranty_end_date` DATE DEFAULT NULL;

-- Add location intelligence fields for branch and customer-density reporting.
ALTER TABLE `transactions` ADD COLUMN IF NOT EXISTS `branch` VARCHAR(100) DEFAULT NULL;
ALTER TABLE `transactions` ADD COLUMN IF NOT EXISTS `customer_location` VARCHAR(255) DEFAULT NULL;
ALTER TABLE `transactions` ADD COLUMN IF NOT EXISTS `latitude` DECIMAL(10,7) DEFAULT NULL;
ALTER TABLE `transactions` ADD COLUMN IF NOT EXISTS `longitude` DECIMAL(10,7) DEFAULT NULL;

-- Allow discontinued products to be deleted while preserving historical line items.
ALTER TABLE `transaction_items` DROP FOREIGN KEY `fk_items_product`;
ALTER TABLE `transaction_items` MODIFY COLUMN `product_id` VARCHAR(50) NULL;
ALTER TABLE `transaction_items` ADD CONSTRAINT `fk_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `repair_ticket_items` DROP FOREIGN KEY `fk_repair_item_product`;
ALTER TABLE `repair_ticket_items` MODIFY COLUMN `product_id` VARCHAR(50) NULL;
ALTER TABLE `repair_ticket_items` ADD CONSTRAINT `fk_repair_item_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS=1;
