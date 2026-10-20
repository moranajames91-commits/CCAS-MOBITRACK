-- Preserve transaction history when a cashier account is deleted.
USE `cims_db`;

ALTER TABLE `transactions`
  DROP FOREIGN KEY `fk_transactions_cashier`;

ALTER TABLE `transactions`
  MODIFY `cashier_username` varchar(50) DEFAULT NULL;

ALTER TABLE `transactions`
  ADD CONSTRAINT `fk_transactions_cashier`
  FOREIGN KEY (`cashier_username`) REFERENCES `cashiers` (`username`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add Jomel only when the account does not already exist.
INSERT INTO `cashiers` (`username`, `fullName`, `password_hash`, `status`, `last_active`)
VALUES ('jomel', 'Jomel', 'jomel', 'active', NOW())
ON DUPLICATE KEY UPDATE `fullName` = VALUES(`fullName`);