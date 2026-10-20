-- Run once in cims_db to store product unit costs and preserve cost per sale.
ALTER TABLE `products`
  ADD COLUMN `cost_price` decimal(10,2) DEFAULT NULL;

ALTER TABLE `transaction_items`
  ADD COLUMN `cost_price` decimal(10,2) DEFAULT NULL;
