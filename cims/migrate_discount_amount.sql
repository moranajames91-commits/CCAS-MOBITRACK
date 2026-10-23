-- Run once in the cims_db database to store discounts as peso amounts.
ALTER TABLE `transactions`
  MODIFY COLUMN `discount_percentage` decimal(12,2) NOT NULL DEFAULT 0.00;
