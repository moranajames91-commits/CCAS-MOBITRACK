<?php
// Keep the legacy XAMPP filename on the same implementation as api.php.
// This prevents checkout writes and transaction-item reads from diverging.
require __DIR__ . '/api.php';
exit;

/**
 * CCAS MOBITRACK (cIMS) - Local Server API for XAMPP
 * Place this file inside C:/xampp/htdocs/cims/api.php
 * Ensure your Apache server is running and MySQL/MariaDB database is imported.
 */

// Disable showing PHP warnings/notices directly in response body to prevent corrupting JSON stream formats
error_reporting(0);
ini_set('display_errors', 0);

// Allow Cross-Origin Requests from your React or Local HTML clients
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$host = 'localhost';
$db_name = 'cims_db';
$username = 'root'; // Default XAMPP username
$password = '';     // Default XAMPP password is empty

try {
    $conn = new PDO("mysql:host=" . $host . ";dbname=" . $db_name . ";charset=utf8", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $exception) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database connection failed: " . $exception->getMessage()]);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

// Parse incoming request body JSON
$inputData = json_decode(file_get_contents("php://input"), true);

// Support both URL query parameters (?action=checkout) and JSON POST bodies ({"action": "checkout"})
$action = isset($_GET['action']) ? $_GET['action'] : (isset($inputData['action']) ? $inputData['action'] : '');

switch ($action) {
    case 'products':
        if ($method === 'GET') {
            // Fetch products
            $stmt = $conn->prepare("SELECT id, barcode, brand, name, price, cost_price AS costPrice, stock, category, description, warranty_start_date AS warrantyStartDate, warranty_end_date AS warrantyEndDate FROM products ORDER BY name ASC");
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
            $id = 'prod-' . uniqid();
            $stmt = $conn->prepare("INSERT INTO products (id, barcode, brand, name, price, cost_price, stock, category, description, warranty_start_date, warranty_end_date) VALUES (:id, :barcode, :brand, :name, :price, :cost_price, :stock, :category, :description, :warranty_start_date, :warranty_end_date)");
            $stmt->execute([
                ':id' => $id,
                ':barcode' => $inputData['barcode'],
                ':brand' => trim($inputData['brand'] ?? ''),
                ':name' => $inputData['name'],
                ':price' => $inputData['price'],
                ':cost_price' => $inputData['costPrice'] ?? $inputData['cost_price'] ?? null,
                ':stock' => isset($inputData['stock']) ? intval($inputData['stock']) : 0,
                ':category' => isset($inputData['category']) ? $inputData['category'] : 'General',
                ':description' => isset($inputData['description']) ? $inputData['description'] : '',
                ':warranty_start_date' => !empty($inputData['warrantyStartDate']) ? $inputData['warrantyStartDate'] : null,
                ':warranty_end_date' => !empty($inputData['warrantyEndDate']) ? $inputData['warrantyEndDate'] : null
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
            $stmt = $conn->prepare("UPDATE products SET barcode = :barcode, brand = :brand, name = :name, price = :price, cost_price = :cost_price, stock = :stock, category = :category, description = :description, warranty_start_date = :warranty_start_date, warranty_end_date = :warranty_end_date WHERE id = :id");
            $stmt->execute([
                ':id' => $inputData['id'],
                ':barcode' => $inputData['barcode'],
                ':brand' => trim($inputData['brand'] ?? ''),
                ':name' => $inputData['name'],
                ':price' => $inputData['price'],
                ':cost_price' => $inputData['costPrice'] ?? $inputData['cost_price'] ?? null,
                ':stock' => intval($inputData['stock']),
                ':category' => $inputData['category'],
                ':description' => $inputData['description'],
                ':warranty_start_date' => !empty($inputData['warrantyStartDate']) ? $inputData['warrantyStartDate'] : null,
                ':warranty_end_date' => !empty($inputData['warrantyEndDate']) ? $inputData['warrantyEndDate'] : null
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
            $stmt = $conn->prepare("INSERT INTO cashiers (username, fullName, password_hash, status, last_active) VALUES (:username, :fullName, :password, :status, NOW()) ON DUPLICKEY UPDATE fullName = :fullName, password_hash = :password, status = :status");
            // Workaround for Mysql non-standard ON DUPLICATE syntax
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
            if (empty($inputData['username'])) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Username parameter is required."]);
                break;
            }
            $stmt = $conn->prepare("DELETE FROM cashiers WHERE username = :username");
            $stmt->execute([':username' => $inputData['username']]);
            echo json_encode(["status" => "success", "message" => "Cashier deleted successfully."]);
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
            $dbTransactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $itemStmt = $conn->prepare("SELECT * FROM transaction_items");
            $itemStmt->execute();
            $itemsDb = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

            $itemsByTx = [];
            foreach ($itemsDb as $item) {
                $txId = $item['transaction_id'];
                if (!isset($itemsByTx[$txId])) {
                    $itemsByTx[$txId] = [];
                }
                $itemsByTx[$txId][] = [
                    'productId' => $item['product_id'],
                    'name' => $item['product_name'],
                    'price' => floatval($item['price']),
                    'quantity' => intval($item['quantity']),
                    'subtotal' => floatval($item['subtotal'])
                ];
            }

            $formatted = [];
            foreach ($dbTransactions as $tx) {
                $txId = $tx['id'];
                $formatted[] = [
                    'id' => $txId,
                    'cashierUsername' => $tx['cashier_username'],
                    'cashierName' => $tx['cashier_name'],
                    'discount' => floatval($tx['discount_percentage']),
                    'subtotal' => floatval($tx['subtotal']),
                    'total' => floatval($tx['total']),
                    'paymentReceived' => floatval($tx['payment_received']),
                    'changeAmount' => floatval($tx['change_amount']),
                    'branch' => $tx['branch'] ?? null,
                    'customerLocation' => $tx['customer_location'] ?? null,
                    'latitude' => $tx['latitude'] !== null ? floatval($tx['latitude']) : null,
                    'longitude' => $tx['longitude'] !== null ? floatval($tx['longitude']) : null,
                    'timestamp' => $tx['timestamp'],
                    'items' => isset($itemsByTx[$txId]) ? $itemsByTx[$txId] : []
                ];
            }

            echo json_encode(["status" => "success", "transactions" => $formatted]);
        }
        break;

    case 'repair_tickets':
        if ($method === 'GET') {
            $stmt = $conn->prepare("SELECT * FROM repair_tickets ORDER BY created_at DESC");
            $stmt->execute();
            $dbRepairTickets = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $itemStmt = $conn->prepare("SELECT * FROM repair_ticket_items ORDER BY id ASC");
            $itemStmt->execute();
            $dbRepairItems = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

            $itemsByRepair = [];
            foreach ($dbRepairItems as $item) {
                $ticketId = $item['repair_ticket_id'];
                if (!isset($itemsByRepair[$ticketId])) {
                    $itemsByRepair[$ticketId] = [];
                }
                $itemsByRepair[$ticketId][] = [
                    'product_id' => $item['product_id'],
                    'product_name' => $item['product_name'],
                    'quantity' => intval($item['quantity']),
                    'issue' => $item['issue'],
                    'status' => $item['status']
                ];
            }

            $formattedRepairTickets = [];
            foreach ($dbRepairTickets as $ticket) {
                $formattedRepairTickets[] = [
                    'id' => $ticket['id'],
                    'customer_name' => $ticket['customer_name'],
                    'contact' => $ticket['contact'],
                    'device' => $ticket['device'],
                    'reported_issue' => $ticket['reported_issue'],
                    'status' => $ticket['status'],
                    'assigned_to' => $ticket['assigned_to'],
                    'notes' => $ticket['notes'],
                    'created_at' => $ticket['created_at'],
                    'updated_at' => $ticket['updated_at'],
                    'items' => isset($itemsByRepair[$ticket['id']]) ? $itemsByRepair[$ticket['id']] : []
                ];
            }

            echo json_encode(["status" => "success", "repair_tickets" => $formattedRepairTickets]);
        }
        break;

    default:
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "Invalid endpoint action"]);
        break;
}
?>
