-- Run once in cims_db to add phone variant fields without changing existing products.
ALTER TABLE `products`
  ADD COLUMN IF NOT EXISTS `ram` varchar(20) DEFAULT NULL AFTER `name`,
  ADD COLUMN IF NOT EXISTS `storage_gb` varchar(20) DEFAULT NULL AFTER `ram`;

-- Existing products remain valid; new catalog entries require storage in the application.