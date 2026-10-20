-- Run once in the cims_db database.
-- Repair ticket timestamps are supplied explicitly by api.php in Asia/Manila time.
SET time_zone = '+08:00';

ALTER TABLE repair_tickets
  MODIFY created_at DATETIME NULL DEFAULT NULL,
  MODIFY updated_at DATETIME NULL DEFAULT NULL;
