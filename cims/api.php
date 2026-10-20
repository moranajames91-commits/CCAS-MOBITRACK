<?php
/**
 * CCAS MOBITRACK (cIMS) - Local Server API for XAMPP
 * Place this file inside C:/xampp/htdocs/cims/api.php
 * Ensure your Apache server is running and MySQL/MariaDB database is imported.
 */

// Disable showing PHP warnings/notices directly in response body to prevent corrupting JSON stream formats
error_reporting(0);
ini_set('display_errors', 0);
date_default_timezone_set('Asia/Manila');

// Allow Cross-Origin Requests from your React or Local HTML clients
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/backup_helper.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$inputData = json_decode(file_get_contents("php://input"), true);
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : (isset($inputData['action']) ? $inputData['action'] : '');

if ($action === 'r2_status') {
    if ($method === 'GET') {
        echo json_encode(["status" => "success", "r2" => ccas_r2_read_status()]);
    } else {
        http_response_code(405);
        echo json_encode(["status" => "error", "message" => "Method not allowed."]);
    }
    exit();
}

if ($action === 'r2_folder') {
    if ($method !== 'POST') {
        http_response_code(405);
        echo json_encode(["status" => "error", "message" => "Method not allowed."]);
        exit();
    }
    $folder = $inputData['folder'] ?? null;
    if (!is_string($folder) || ccas_r2_folder_prefix($folder) === null) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Enter a folder name using valid path segments (no empty, '.' or '..' segments)."]);
        exit();
    }
    if (!ccas_r2_store_folder($folder)) {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Could not save the R2 folder setting on the server. Check the backup directory permissions."]);
        exit();
    }
    echo json_encode(["status" => "success", "r2" => ccas_r2_read_status()]);
    exit();
}

if ($action === 'r2_backup_now' && $method !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed."]);
    exit();
}

$host = 'localhost';
$db_name = 'cims_db';
$username = 'root'; // Default XAMPP username
$password = '';     // Default XAMPP password is empty

try {
    $conn = ccas_connect_and_validate($host, $db_name, $username, $password);
} catch (Throwable $exception) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database connection failed: " . $exception->getMessage()]);
    exit();
}

if ($action === 'r2_backup_now') {
    try {
        $backupCreated = triggerAutoBackup($conn);
        $r2Status = ccas_r2_read_status();
    } catch (Throwable $exception) {
        error_log('[BACKUP] Manual transaction backup failed: ' . $exception->getMessage());
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Manual transaction backup failed. Check the PHP error log for details.",
        ]);
        exit();
    }
    if (!$backupCreated) {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Could not create the local transaction backup. Check the PHP error log.",
            "r2" => $r2Status,
        ]);
        exit();
    }
    if ($r2Status['lastResult'] !== 'success') {
        http_response_code(502);
        echo json_encode([
            "status" => "error",
            "message" => $r2Status['message'] ?? "The local backup was created, but R2 upload failed.",
            "r2" => $r2Status,
        ]);
        exit();
    }
    echo json_encode([
        "status" => "success",
        "message" => "Transaction JSON and XLSX backups were saved locally and uploaded to R2.",
        "r2" => $r2Status,
    ]);
    exit();
}

ccas_register_write_backup($conn, $action, $method);

switch ($action) {
    case 'products':
        if ($method === 'GET') {
            // Fetch products
            $stmt = $conn->prepare("SELECT id, barcode, brand, name, ram, storage_gb AS storageGb, price, cost_price AS costPrice, stock, category, description, warranty_days AS warrantyDays, warranty_days AS warranty_days FROM products ORDER BY name ASC");
            $stmt->execute();
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(["status" => "success", "products" => $products]);
        } elseif ($method === 'POST') {
            // Create a new product
            if (empty($inputData['name']) || empty($inputData['barcode']) || !isset($inputData['price'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Missing required product fields."]);
                break;
            }
            $costPrice = $inputData['costPrice'] ?? $inputData['cost_price'] ?? null;
            if ($costPrice !== null && $costPrice !== '' && (!is_numeric($costPrice) || (float)$costPrice < 0)) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Unit cost must be a non-negative amount."]);
                break;
            }
            if ($costPrice === '') $costPrice = null;
            $id = 'prod-' . uniqid();
            if (strtolower(trim($inputData['category'] ?? '')) !== 'accessories' && empty($inputData['storageGb'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Storage/ROM is required."]);
                break;
            }
            $stmt = $conn->prepare("INSERT INTO products (id, barcode, brand, name, ram, storage_gb, price, cost_price, stock, category, description, warranty_days) VALUES (:id, :barcode, :brand, :name, :ram, :storage_gb, :price, :cost_price, :stock, :category, :description, :warranty_days)");
            $stmt->execute([
                ':id' => $id,
                ':barcode' => $inputData['barcode'],
                ':brand' => trim($inputData['brand'] ?? ''),
                ':name' => $inputData['name'],
                ':ram' => trim($inputData['ram'] ?? ''),
                ':storage_gb' => trim($inputData['storageGb'] ?? ''),
                ':price' => $inputData['price'],
                ':cost_price' => $costPrice,
                ':stock' => isset($inputData['stock']) ? intval($inputData['stock']) : 0,
                ':category' => isset($inputData['category']) ? $inputData['category'] : 'General',
                ':description' => isset($inputData['description']) ? $inputData['description'] : '',
                ':warranty_days' => isset($inputData['warrantyDays']) ? intval($inputData['warrantyDays']) : null
            ]);
            echo json_encode(["status" => "success", "message" => "Product created successfully", "id" => $id]);
        }
        break;

    case 'product_update':
        if ($method === 'PUT' || $method === 'POST') {
            // Update an existing product
            if (empty($inputData['id']) || empty($inputData['name']) || !isset($inputData['price'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Missing required update parameters."]);
                break;
            }
            $costPrice = $inputData['costPrice'] ?? $inputData['cost_price'] ?? null;
            if ($costPrice !== null && $costPrice !== '' && (!is_numeric($costPrice) || (float)$costPrice < 0)) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Unit cost must be a non-negative amount."]);
                break;
            }
            if ($costPrice === '') $costPrice = null;
            if (strtolower(trim($inputData['category'] ?? '')) !== 'accessories' && empty($inputData['storageGb'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Storage/ROM is required."]);
                break;
            }
            $stmt = $conn->prepare("UPDATE products SET barcode = :barcode, brand = :brand, name = :name, ram = :ram, storage_gb = :storage_gb, price = :price, cost_price = :cost_price, stock = :stock, category = :category, description = :description, warranty_days = :warranty_days WHERE id = :id");
            $stmt->execute([
                ':id' => $inputData['id'],
                ':barcode' => $inputData['barcode'],
                ':brand' => trim($inputData['brand'] ?? ''),
                ':name' => $inputData['name'],
                ':ram' => trim($inputData['ram'] ?? ''),
                ':storage_gb' => trim($inputData['storageGb'] ?? ''),
                ':price' => $inputData['price'],
                ':cost_price' => $costPrice,
                ':stock' => intval($inputData['stock']),
                ':category' => $inputData['category'],
                ':description' => $inputData['description'],
                ':warranty_days' => isset($inputData['warrantyDays']) ? intval($inputData['warrantyDays']) : null
            ]);
            echo json_encode(["status" => "success", "message" => "Product updated successfully"]);
        }
        break;

    case 'product_delete':
        if ($method === 'DELETE' || $method === 'POST') {
            $idToDelete = isset($_GET['id']) ? $_GET['id'] : (isset($inputData['id']) ? $inputData['id'] : '');
            if (empty($idToDelete)) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Identifier parameter 'id' is required."]);
                break;
            }
            $stmt = $conn->prepare("DELETE FROM products WHERE id = :id");
            $stmt->execute([':id' => $idToDelete]);
            echo json_encode(["status" => "success", "message" => "Product deleted successfully"]);
        }
        break;

    case 'cashiers':
        if ($method === 'GET') {
            $stmt = $conn->prepare("SELECT username, fullName, password_hash, status, last_active FROM cashiers");
            $stmt->execute();
            $cashiers = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(["status" => "success", "cashiers" => $cashiers]);
        }
        break;

    case 'admins':
        if ($method === 'GET') {
            $stmt = $conn->prepare("SELECT username, fullName, password_hash FROM admins");
            $stmt->execute();
            $dbAdmins = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $formattedAdmins = [];
            foreach ($dbAdmins as $adm) {
                $formattedAdmins[] = [
                    'username' => $adm['username'],
                    'fullName' => $adm['fullName'],
                    'passwordHash' => $adm['password_hash']
                ];
            }
            echo json_encode(["status" => "success", "admins" => $formattedAdmins]);
        }
        break;

    case 'add_admin':
        if ($method === 'POST') {
            if (empty($inputData['username']) || empty($inputData['fullName']) || empty($inputData['passwordHash'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Missing required administrator fields."]);
                break;
            }
            $chk = $conn->prepare("SELECT username FROM admins WHERE username = :username");
            $chk->execute([':username' => $inputData['username']]);
            if ($chk->fetch()) {
                $stmt = $conn->prepare("UPDATE admins SET fullName = :fullName, password_hash = :password WHERE username = :username");
            } else {
                $stmt = $conn->prepare("INSERT INTO admins (username, fullName, password_hash) VALUES (:username, :fullName, :password)");
            }
            $stmt->execute([
                ':username' => $inputData['username'],
                ':fullName' => $inputData['fullName'],
                ':password' => $inputData['passwordHash']
            ]);
            echo json_encode(["status" => "success", "message" => "Administrator registered successfully."]);
        }
        break;

    case 'delete_admin':
        if ($method === 'POST') {
            if (empty($inputData['username'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Username parameter is required."]);
                break;
            }
            $stmt = $conn->prepare("DELETE FROM admins WHERE username = :username");
            $stmt->execute([':username' => $inputData['username']]);
            echo json_encode(["status" => "success", "message" => "Administrator deleted successfully."]);
        }
        break;

    case 'add_cashier':
        if ($method === 'POST') {
            if (empty($inputData['username']) || empty($inputData['fullName']) || empty($inputData['passwordHash'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Missing required cashier fields."]);
                break;
            }
            $chk = $conn->prepare("SELECT username FROM cashiers WHERE username = :username");
            $chk->execute([':username' => $inputData['username']]);
            if ($chk->fetch()) {
                $stmt = $conn->prepare("UPDATE cashiers SET fullName = :fullName, password_hash = :password, status = :status WHERE username = :username");
            } else {
                $stmt = $conn->prepare("INSERT INTO cashiers (username, fullName, password_hash, status) VALUES (:username, :fullName, :password, :status)");
            }
            $stmt->execute([
                ':username' => $inputData['username'],
                ':fullName' => $inputData['fullName'],
                ':password' => $inputData['passwordHash'],
                ':status' => isset($inputData['status']) ? $inputData['status'] : 'active'
            ]);
            echo json_encode(["status" => "success", "message" => "Cashier registered successfully."]);
        }
        break;

    case 'delete_cashier':
        if ($method === 'POST') {
            $cashierUsername = trim((string)($inputData['username'] ?? ''));
            if ($cashierUsername === '') {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Username parameter is required."]);
                break;
            }
            try {
                $stmt = $conn->prepare("DELETE FROM cashiers WHERE username = :username");
                $stmt->execute([':username' => $cashierUsername]);
                if ($stmt->rowCount() === 0) {
                    http_response_code(404);
                    echo json_encode(["status" => "error", "message" => "Cashier '{$cashierUsername}' was not found in the database."]);
                    break;
                }
                echo json_encode(["status" => "success", "message" => "Cashier deleted successfully."]);
            } catch (PDOException $exception) {
                http_response_code(409);
                echo json_encode(["status" => "error", "message" => "Cashier cannot be deleted until the database migration migrate_cashier_delete.sql is applied. Existing transaction history is protected."]);
            }
        }
        break;

    case 'reset_cashier_password':
        if ($method === 'POST') {
            if (empty($inputData['username']) || empty($inputData['newPassword'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Missing username or newPassword."]);
                break;
            }
            $stmt = $conn->prepare("UPDATE cashiers SET password_hash = :password WHERE username = :username");
            $stmt->execute([
                ':username' => $inputData['username'],
                ':password' => $inputData['newPassword']
            ]);
            echo json_encode(["status" => "success", "message" => "Cashier password updated successfully."]);
        }
        break;

    case 'transactions':
        if ($method === 'GET') {
            $stmt = $conn->prepare("SELECT * FROM transactions ORDER BY timestamp DESC");
            $stmt->execute();
            $dbTxs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $transactionsList = [];
            foreach ($dbTxs as $tx) {
                $itemStmt = $conn->prepare("SELECT * FROM transaction_items WHERE transaction_id = :tx_id");
                $itemStmt->execute([':tx_id' => $tx['id']]);
                $dbItems = $itemStmt->fetchAll(PDO::FETCH_ASSOC);
                $items = [];
                foreach ($dbItems as $dbItem) {
                    $items[] = [
                        'productId' => $dbItem['product_id'],
                        'name' => $dbItem['product_name'],
                        'price' => floatval($dbItem['price']),
                        'costPrice' => $dbItem['cost_price'] !== null ? floatval($dbItem['cost_price']) : null,
                        'quantity' => intval($dbItem['quantity']),
                        'subtotal' => floatval($dbItem['subtotal']),
                        'warrantyDays' => $dbItem['warranty_days'] !== null ? intval($dbItem['warranty_days']) : null,
                        'warrantyStartDate' => $dbItem['warranty_start_date'] ?: null,
                        'warrantyEndDate' => $dbItem['warranty_end_date'] ?: null
                    ];
                }
                $transactionsList[] = [
                    'id' => $tx['id'],
                    'cashierUsername' => $tx['cashier_username'] ?? 'deleted-cashier',
                    'cashierName' => $tx['cashier_name'],
                    'items' => $items,
                    'discount' => floatval($tx['discount_percentage']),
                    'subtotal' => floatval($tx['subtotal']),
                    'total' => floatval($tx['total']),
                    'paymentReceived' => floatval($tx['payment_received']),
                    'changeAmount' => floatval($tx['change_amount']),
                    'branch' => $tx['branch'] ?? null,
                    'customerLocation' => $tx['customer_location'] ?? null,
                    'latitude' => $tx['latitude'] !== null ? floatval($tx['latitude']) : null,
                    'longitude' => $tx['longitude'] !== null ? floatval($tx['longitude']) : null,
                    'timestamp' => date('c', strtotime($tx['timestamp']))
                ];
            }
            echo json_encode(["status" => "success", "transactions" => $transactionsList]);
        }
        break;

    case 'checkout':
        if ($method === 'POST') {
            if (empty($inputData['cashierUsername']) || empty($inputData['items']) || !isset($inputData['total'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Incomplete transaction structure."]);
                break;
            }

            try {
                // Begin Transaction block to ensure complete integrity
                $conn->beginTransaction();

                $txId = !empty($inputData['id'])
                    ? trim($inputData['id'])
                    : 'TX-' . date('YmdHis') . '-' . rand(10, 99);
                
                // Fetch cashier full name
                $cStmt = $conn->prepare("SELECT fullName FROM cashiers WHERE username = :username");
                $cStmt->execute([':username' => $inputData['cashierUsername']]);
                $cRes = $cStmt->fetch(PDO::FETCH_ASSOC);
                $cashierName = $cRes ? $cRes['fullName'] : 'Unknown Cashier';

                // Insert into transactions
                $stmt = $conn->prepare("INSERT INTO transactions (id, cashier_username, cashier_name, discount_percentage, subtotal, total, payment_received, change_amount, branch, customer_location, latitude, longitude, timestamp) VALUES (:id, :username, :name, :discount, :subtotal, :total, :received, :change, :branch, :customer_location, :latitude, :longitude, :timestamp)");
                $stmt->execute([
                    ':id' => $txId,
                    ':username' => $inputData['cashierUsername'],
                    ':name' => $cashierName,
                    ':discount' => isset($inputData['discount']) ? floatval($inputData['discount']) : 0.00,
                    ':subtotal' => floatval($inputData['subtotal']),
                    ':total' => floatval($inputData['total']),
                    ':received' => floatval($inputData['paymentReceived']),
                    ':change' => floatval($inputData['changeAmount']),
                    ':branch' => $inputData['branch'] ?? null,
                    ':customer_location' => $inputData['customerLocation'] ?? null,
                    ':latitude' => isset($inputData['latitude']) ? floatval($inputData['latitude']) : null,
                    ':longitude' => isset($inputData['longitude']) ? floatval($inputData['longitude']) : null,
                    ':timestamp' => !empty($inputData['timestamp'])
                        ? (new DateTime($inputData['timestamp'], new DateTimeZone('Asia/Manila')))->setTimezone(new DateTimeZone('Asia/Manila'))->format('Y-m-d H:i:s')
                        : date('Y-m-d H:i:s')
                ]);

                // Insert items & reduce stock
                $itemStmt = $conn->prepare("INSERT INTO transaction_items (transaction_id, product_id, product_name, price, cost_price, quantity, subtotal, warranty_days, warranty_start_date, warranty_end_date) VALUES (:tx, :prod, :pname, :price, :cost_price, :qty, :sub, :warranty_days, :warranty_start, :warranty_end)");
                $stockUpdateStmt = $conn->prepare("UPDATE products SET stock = stock - :qty WHERE id = :id");
                $productDetailsStmt = $conn->prepare("SELECT cost_price, warranty_days FROM products WHERE id = :id");
                $purchaseDate = new DateTime('now', new DateTimeZone('Asia/Manila'));
                $warrantyStartDate = $purchaseDate->format('Y-m-d');

                foreach ($inputData['items'] as $item) {
                    $productId = $item['productId'] ?? $item['product_id'] ?? '';
                    $productName = $item['name'] ?? $item['product_name'] ?? '';
                    $quantity = intval($item['quantity'] ?? 0);

                    if ($productId === '' || $productName === '' || $quantity <= 0) {
                        throw new InvalidArgumentException('Each transaction item requires productId, name, and a positive quantity.');
                    }

                    // Inventory is authoritative; never fall back to a default checkout duration.
                    $productDetailsStmt->execute([':id' => $productId]);
                    $productDetails = $productDetailsStmt->fetch(PDO::FETCH_ASSOC);
                    if (!$productDetails) {
                        throw new InvalidArgumentException("Product '{$productId}' was not found.");
                    }
                    $productWarrantyDays = $productDetails['warranty_days'];
                    $warrantyDays = $productWarrantyDays !== null
                        ? max(0, intval($productWarrantyDays))
                        : 0;
                    $warrantyEndDate = null;
                    if ($warrantyDays > 0) {
                        $warrantyEnd = clone $purchaseDate;
                        $warrantyEnd->modify("+{$warrantyDays} days");
                        $warrantyEndDate = $warrantyEnd->format('Y-m-d');
                    }

                    $itemStmt->execute([
                        ':tx' => $txId,
                        ':prod' => $productId,
                        ':pname' => $productName,
                        ':price' => floatval($item['price'] ?? 0),
                        ':cost_price' => $productDetails['cost_price'],
                        ':qty' => $quantity,
                        ':sub' => floatval($item['subtotal'] ?? 0),
                        ':warranty_days' => $warrantyDays > 0 ? $warrantyDays : null,
                        ':warranty_start' => $warrantyDays > 0 ? $warrantyStartDate : null,
                        ':warranty_end' => $warrantyEndDate
                    ]);

                    $stockUpdateStmt->execute([
                        ':qty' => $quantity,
                        ':id' => $productId
                    ]);
                }

                // Update cashier last active field
                $actStmt = $conn->prepare("UPDATE cashiers SET last_active = NOW() WHERE username = :username");
                $actStmt->execute([':username' => $inputData['cashierUsername']]);

                $conn->commit();
                echo json_encode(["status" => "success", "message" => "Invoice processed", "transaction_id" => $txId]);

            } catch (Exception $err) {
                $conn->rollBack();
                http_response_code(500);
                echo json_encode(["status" => "error", "message" => "Transaction error: " . $err->getMessage()]);
            }
        }
        break;

    case 'transaction_delete':
        if ($method === 'POST' || $method === 'DELETE') {
            $transactionId = $inputData['id'] ?? $_GET['id'] ?? '';
            if (empty($transactionId)) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Transaction id is required."]);
                break;
            }
            $stmt = $conn->prepare("DELETE FROM transactions WHERE id = :id");
            $stmt->execute([':id' => $transactionId]);
            echo json_encode(["status" => "success", "message" => "Transaction deleted"]);
        }
        break;

    case 'operating_expenses':
        if ($method === 'GET') {
            $stmt = $conn->prepare("SELECT id, category, description, amount, expense_date AS expenseDate, created_at AS createdAt FROM operating_expenses ORDER BY expense_date DESC, created_at DESC");
            $stmt->execute();
            $expenses = array_map(static function ($expense) {
                return [
                    'id' => $expense['id'],
                    'category' => $expense['category'],
                    'description' => $expense['description'],
                    'amount' => (float)$expense['amount'],
                    'date' => $expense['expenseDate'],
                    'createdAt' => $expense['createdAt']
                ];
            }, $stmt->fetchAll(PDO::FETCH_ASSOC));
            echo json_encode(["status" => "success", "operatingExpenses" => $expenses]);
        } elseif ($method === 'POST') {
            $category = trim((string)($inputData['category'] ?? ''));
            $description = trim((string)($inputData['description'] ?? ''));
            $amount = $inputData['amount'] ?? null;
            $expenseDate = trim((string)($inputData['date'] ?? ''));
            $parsedDate = DateTime::createFromFormat('!Y-m-d', $expenseDate);
            if ($category === '' || $description === '' || !is_numeric($amount) || (float)$amount <= 0
                || !$parsedDate || $parsedDate->format('Y-m-d') !== $expenseDate) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "A category, description, positive amount, and valid expense date are required."]);
                break;
            }
            $id = trim((string)($inputData['id'] ?? ''));
            if ($id === '') $id = 'opex-' . bin2hex(random_bytes(12));
            $stmt = $conn->prepare("INSERT INTO operating_expenses (id, category, description, amount, expense_date) VALUES (:id, :category, :description, :amount, :expense_date)");
            $stmt->execute([
                ':id' => $id,
                ':category' => $category,
                ':description' => $description,
                ':amount' => (float)$amount,
                ':expense_date' => $expenseDate
            ]);
            echo json_encode(["status" => "success", "message" => "Operating expense recorded.", "id" => $id]);
        }
        break;

    case 'operating_expense_delete':
        if ($method === 'POST' || $method === 'DELETE') {
            $id = trim((string)($inputData['id'] ?? $_GET['id'] ?? ''));
            if ($id === '') {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Expense id is required."]);
                break;
            }
            $stmt = $conn->prepare("DELETE FROM operating_expenses WHERE id = :id");
            $stmt->execute([':id' => $id]);
            if ($stmt->rowCount() === 0) {
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Operating expense was not found."]);
                break;
            }
            echo json_encode(["status" => "success", "message" => "Operating expense deleted."]);
        }
        break;

    case 'repair_tickets':
        if ($method === 'GET') {
            $stmt = $conn->prepare("SELECT * FROM repair_tickets ORDER BY created_at DESC");
            $stmt->execute();
            $tickets = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $itemsStmt = $conn->prepare("SELECT * FROM repair_ticket_items ORDER BY id ASC");
            $itemsStmt->execute();
            $itemsByTicket = [];
            foreach ($itemsStmt->fetchAll(PDO::FETCH_ASSOC) as $item) {
                $itemsByTicket[$item['repair_ticket_id']][] = [
                    'product_id' => $item['product_id'],
                    'product_name' => $item['product_name'],
                    'quantity' => intval($item['quantity']),
                    'issue' => $item['issue'],
                    'status' => $item['status']
                ];
            }
            foreach ($tickets as &$ticket) {
                // Include the Manila offset so browsers do not reinterpret MySQL timestamps in local time.
                $ticket['created_at'] = date('c', strtotime($ticket['created_at']));
                $ticket['updated_at'] = $ticket['updated_at'] ? date('c', strtotime($ticket['updated_at'])) : null;
                $ticket['latitude'] = $ticket['latitude'] !== null ? floatval($ticket['latitude']) : null;
                $ticket['longitude'] = $ticket['longitude'] !== null ? floatval($ticket['longitude']) : null;
                $ticket['items'] = $itemsByTicket[$ticket['id']] ?? [];
            }
            unset($ticket);
            echo json_encode(["status" => "success", "repair_tickets" => $tickets]);
        } elseif ($method === 'POST') {
            if (empty($inputData['id']) || empty($inputData['customerName']) || empty($inputData['device']) || empty($inputData['reportedIssue'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Missing required repair ticket fields."]);
                break;
            }
            $stmt = $conn->prepare("INSERT INTO repair_tickets (id, customer_name, contact, device, reported_issue, status, assigned_to, warranty_days, warranty_start_date, warranty_end_date, customer_address, latitude, longitude, notes, created_at, updated_at) VALUES (:id, :customer_name, :contact, :device, :reported_issue, :status, :assigned_to, :warranty_days, :warranty_start_date, :warranty_end_date, :customer_address, :latitude, :longitude, :notes, :created_at, :updated_at)");
            $createdAt = !empty($inputData['createdAt'])
                ? (new DateTime($inputData['createdAt'], new DateTimeZone('Asia/Manila')))->setTimezone(new DateTimeZone('Asia/Manila'))->format('Y-m-d H:i:s')
                : date('Y-m-d H:i:s');
            $updatedAt = $createdAt;
            $stmt->execute([
                ':id' => $inputData['id'],
                ':customer_name' => $inputData['customerName'],
                ':contact' => $inputData['contact'] ?? '',
                ':device' => $inputData['device'],
                ':reported_issue' => $inputData['reportedIssue'],
                ':status' => $inputData['status'] ?? 'open',
                ':assigned_to' => $inputData['assignedTo'] ?? null,
                ':warranty_days' => isset($inputData['warrantyDays']) ? intval($inputData['warrantyDays']) : null,
                ':warranty_start_date' => $inputData['warrantyStartDate'] ?? null,
                ':warranty_end_date' => $inputData['warrantyEndDate'] ?? null,
                ':customer_address' => $inputData['customerAddress'] ?? null,
                ':latitude' => isset($inputData['latitude']) ? floatval($inputData['latitude']) : null,
                ':longitude' => isset($inputData['longitude']) ? floatval($inputData['longitude']) : null,
                ':notes' => $inputData['notes'] ?? null,
                ':created_at' => $createdAt,
                ':updated_at' => $updatedAt
            ]);
            echo json_encode(["status" => "success", "message" => "Repair ticket created", "id" => $inputData['id']]);
        }
        break;

    case 'repair_ticket_update':
        if ($method === 'POST' || $method === 'PUT') {
            if (empty($inputData['id']) || empty($inputData['customerName']) || empty($inputData['device']) || empty($inputData['reportedIssue'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Missing required repair ticket fields."]);
                break;
            }
            $stmt = $conn->prepare("UPDATE repair_tickets SET customer_name = :customer_name, contact = :contact, device = :device, reported_issue = :reported_issue, status = :status, assigned_to = :assigned_to, warranty_days = :warranty_days, warranty_start_date = :warranty_start_date, warranty_end_date = :warranty_end_date, customer_address = :customer_address, latitude = :latitude, longitude = :longitude, notes = :notes, updated_at = :updated_at WHERE id = :id");
            $stmt->execute([
                ':id' => $inputData['id'],
                ':customer_name' => $inputData['customerName'],
                ':contact' => $inputData['contact'] ?? '',
                ':device' => $inputData['device'],
                ':reported_issue' => $inputData['reportedIssue'],
                ':status' => $inputData['status'] ?? 'open',
                ':assigned_to' => $inputData['assignedTo'] ?? null,
                ':warranty_days' => isset($inputData['warrantyDays']) ? intval($inputData['warrantyDays']) : null,
                ':warranty_start_date' => $inputData['warrantyStartDate'] ?? null,
                ':warranty_end_date' => $inputData['warrantyEndDate'] ?? null,
                ':customer_address' => $inputData['customerAddress'] ?? null,
                ':latitude' => isset($inputData['latitude']) ? floatval($inputData['latitude']) : null,
                ':longitude' => isset($inputData['longitude']) ? floatval($inputData['longitude']) : null,
                ':notes' => $inputData['notes'] ?? null,
                ':updated_at' => !empty($inputData['updatedAt'])
                    ? (new DateTime($inputData['updatedAt'], new DateTimeZone('Asia/Manila')))->setTimezone(new DateTimeZone('Asia/Manila'))->format('Y-m-d H:i:s')
                    : date('Y-m-d H:i:s')
            ]);
            echo json_encode(["status" => "success", "message" => "Repair ticket updated"]);
        }
        break;

    case 'repair_ticket_delete':
        if ($method === 'POST' || $method === 'DELETE') {
            $id = $inputData['id'] ?? $_GET['id'] ?? '';
            if (empty($id)) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Repair ticket id is required."]);
                break;
            }
            $stmt = $conn->prepare("DELETE FROM repair_tickets WHERE id = :id");
            $stmt->execute([':id' => $id]);
            echo json_encode(["status" => "success", "message" => "Repair ticket deleted"]);
        }
        break;
                

    default:
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Invalid endpoint action"]);
        break;
}
?> 