<?php
// ==========================================================
// API Configuration Manager
// Handles retrieval and management of external API keys
// ==========================================================

// Suppress display of warnings in JSON output
error_reporting(E_ALL);
ini_set('display_errors', 0);
date_default_timezone_set('Asia/Manila');

header('Content-Type: application/json');

require_once __DIR__ . '/backup_helper.php';

// Database connection
$host = 'localhost';
$user = 'root';
$pass = '';
$db = 'cims_db';

try {
    $pdo = ccas_connect_and_validate($host, $db, $user, $pass);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit();
}

// Get the request method
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
ccas_register_write_backup($pdo, $action, $method);

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

$apiConfigTable = resolveApiConfigTable($pdo);

// Endpoints
switch ($action) {
    case 'get':
    case 'get_one':
        getApiConfig($_GET['api_name'] ?? null);
        break;

    case 'get_all':
    case 'api_configs':
        getAllApiConfigs();
        break;

    case 'update':
        updateApiConfig();
        break;

    case 'create':
        createApiConfig();
        break;

    case 'delete':
        deleteApiConfig($_GET['id'] ?? null);
        break;

    case 'toggle_status':
        toggleApiStatus($_GET['id'] ?? null);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
        exit();
}

// =========== FUNCTION IMPLEMENTATIONS ===========

function resolveApiConfigTable($pdo) {
    foreach (['api_configuration', 'api_configurations'] as $tableName) {
        try {
            $stmt = $pdo->query("SELECT 1 FROM `$tableName` LIMIT 1");
            $stmt->fetch(PDO::FETCH_ASSOC);
            return $tableName;
        } catch (PDOException $e) {
            // Try next table name
        }
    }

    return 'api_configuration';
}

function getApiConfig($apiName) {
    global $pdo;
    $tableName = $GLOBALS['apiConfigTable'];

    if (!$apiName) {
        http_response_code(400);
        echo json_encode(['error' => 'api_name is required']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT * FROM `$tableName` WHERE api_name = ? AND status = 'active'");
        $stmt->execute([$apiName]);
        $config = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($config) {
            if ($config['config_data']) {
                $config['config_data'] = json_decode($config['config_data'], true);
            }
            echo json_encode(['success' => true, 'status' => 'success', 'data' => $config]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'API configuration not found']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

function getAllApiConfigs() {
    global $pdo;
    $tableName = $GLOBALS['apiConfigTable'];

    try {
        $stmt = $pdo->query("SELECT id, api_name, api_key, base_url, status, description, config_data, created_at, updated_at FROM `$tableName` ORDER BY created_at DESC");
        $configs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($configs as &$config) {
            if (!empty($config['config_data']) && is_string($config['config_data'])) {
                $config['config_data'] = json_decode($config['config_data'], true);
            }
        }

        echo json_encode(['success' => true, 'status' => 'success', 'data' => $configs, 'count' => count($configs)]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

function createApiConfig() {
    global $pdo;
    $tableName = $GLOBALS['apiConfigTable'];

    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data['api_name'] || !$data['api_key']) {
        http_response_code(400);
        echo json_encode(['error' => 'api_name and api_key are required']);
        return;
    }

    try {
        $config_data = isset($data['config_data']) && $data['config_data'] ? json_encode($data['config_data']) : null;

        $stmt = $pdo->prepare("
            INSERT INTO `$tableName` (api_name, api_key, base_url, status, description, config_data)
            VALUES (?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            trim($data['api_name']),
            trim($data['api_key']),
            $data['base_url'] ?? null,
            $data['status'] ?? 'active',
            $data['description'] ?? null,
            $config_data
        ]);

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'status' => 'success',
            'message' => 'API configuration created',
            'id' => $pdo->lastInsertId()
        ]);
    } catch (PDOException $e) {
        http_response_code(400);
        echo json_encode(['error' => 'Could not create configuration: ' . $e->getMessage()]);
    }
}

function updateApiConfig() {
    global $pdo;
    $tableName = $GLOBALS['apiConfigTable'];

    $data = json_decode(file_get_contents('php://input'), true);

    if (!isset($data['id']) || !$data['id']) {
        http_response_code(400);
        echo json_encode(['error' => 'id is required']);
        return;
    }

    try {
        $config_data = isset($data['config_data']) && $data['config_data'] ? json_encode($data['config_data']) : null;

        $stmt = $pdo->prepare("
            UPDATE `$tableName`
            SET api_name = ?, api_key = ?, base_url = ?, status = ?, description = ?, config_data = ?
            WHERE id = ?
        ");

        $stmt->execute([
            $data['api_name'] ?? null,
            $data['api_key'] ?? null,
            $data['base_url'] ?? null,
            $data['status'] ?? 'active',
            $data['description'] ?? null,
            $config_data,
            $data['id']
        ]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'status' => 'success', 'message' => 'API configuration updated']);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'API configuration not found']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Update failed: ' . $e->getMessage()]);
    }
}

function deleteApiConfig($id) {
    global $pdo;
    $tableName = $GLOBALS['apiConfigTable'];

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'id is required']);
        return;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM `$tableName` WHERE id = ?");
        $stmt->execute([$id]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'status' => 'success', 'message' => 'API configuration deleted']);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'API configuration not found']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Delete failed: ' . $e->getMessage()]);
    }
}

function toggleApiStatus($id) {
    global $pdo;
    $tableName = $GLOBALS['apiConfigTable'];

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'id is required']);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            UPDATE `$tableName`
            SET status = IF(status = 'active', 'inactive', 'active')
            WHERE id = ?
        ");
        $stmt->execute([$id]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'status' => 'success', 'message' => 'API status toggled']);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'API configuration not found']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Toggle failed: ' . $e->getMessage()]);
    }
}
?>