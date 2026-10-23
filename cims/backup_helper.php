<?php
/**
 * CCAS MOBITRACK transaction backup helpers.
 */

const CCAS_BACKUP_DIRECTORY = 'D:/CCAS_SYSTEM_BACKUPS';
const CCAS_BACKUP_RETENTION_DAYS = 30;
const CCAS_R2_STATUS_FILE = 'D:/CCAS_SYSTEM_BACKUPS/.r2_backup_status.json';
const CCAS_R2_FOLDER_FILE = 'D:/CCAS_SYSTEM_BACKUPS/.r2_backup_folder.json';
const CCAS_R2_ENV_FILE = 'C:/xampp/private/cims-r2.env';
const CCAS_R2_CA_BUNDLE = 'C:/xampp/private/cacert.pem';

function ccas_r2_environment_value(string $name): string
{
    static $fileValues = null;
    if ($fileValues === null) {
        $fileValues = [];
        if (is_file(CCAS_R2_ENV_FILE) && is_readable(CCAS_R2_ENV_FILE)) {
            $lines = file(CCAS_R2_ENV_FILE, FILE_IGNORE_NEW_LINES);
            if ($lines === false) {
                error_log('[R2 BACKUP] Unable to read the local R2 environment file.');
            } else {
                foreach ($lines as $line) {
                    $line = trim($line);
                    if ($line === '' || str_starts_with($line, '#')) {
                        continue;
                    }

                    $separator = strpos($line, '=');
                    if ($separator === false) {
                        continue;
                    }

                    $key = trim(substr($line, 0, $separator));
                    $value = trim(substr($line, $separator + 1));
                    if (preg_match('/^([\'"])(.*)\\1$/', $value, $matches)) {
                        $value = $matches[2];
                    }
                    if (preg_match('/^CIMS_R2_[A-Z0-9_]+$/', $key)) {
                        $fileValues[$key] = $value;
                    }
                }
            }
        }
    }

    $fileValue = trim((string)($fileValues[$name] ?? ''));
    if ($fileValue !== '') {
        return $fileValue;
    }

    $environmentValue = getenv($name);
    return $environmentValue === false ? '' : trim($environmentValue);
}

function ccas_r2_configuration(): array
{
    $savedFolder = null;
    if (is_file(CCAS_R2_FOLDER_FILE)) {
        $savedConfiguration = json_decode((string)@file_get_contents(CCAS_R2_FOLDER_FILE), true);
        if (is_array($savedConfiguration) && isset($savedConfiguration['folder']) && is_string($savedConfiguration['folder'])) {
            $savedFolder = $savedConfiguration['folder'];
        } else {
            error_log('[R2 BACKUP] Saved folder configuration is invalid; using the environment/default folder.');
        }
    }

    return [
        'account_id' => ccas_r2_environment_value('CIMS_R2_ACCOUNT_ID'),
        'access_key_id' => ccas_r2_environment_value('CIMS_R2_ACCESS_KEY_ID'),
        'secret_access_key' => ccas_r2_environment_value('CIMS_R2_SECRET_ACCESS_KEY'),
        'bucket' => ccas_r2_environment_value('CIMS_R2_BUCKET'),
        'folder' => trim($savedFolder ?? (ccas_r2_environment_value('CIMS_R2_FOLDER') ?: 'cims/mysql'), '/'),
    ];
}

function ccas_r2_folder_prefix(string $folder): ?string
{
    $folder = trim($folder, '/');
    if ($folder === '' || strlen($folder) > 200 || str_contains($folder, '\\') || preg_match('/[\x00-\x1F\x7F]/', $folder)) {
        return null;
    }

    $segments = explode('/', $folder);
    foreach ($segments as $segment) {
        if ($segment === '' || $segment === '.' || $segment === '..') {
            return null;
        }
    }

    return $folder;
}

function ccas_r2_store_folder(string $folder): bool
{
    $folder = ccas_r2_folder_prefix($folder);
    if ($folder === null || !ccas_ensure_backup_directory()) {
        return false;
    }

    $temporaryFile = CCAS_R2_FOLDER_FILE . '.tmp';
    $saved = @file_put_contents(
        $temporaryFile,
        json_encode(['folder' => $folder], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
        LOCK_EX
    );
    if ($saved === false || !@rename($temporaryFile, CCAS_R2_FOLDER_FILE)) {
        @unlink($temporaryFile);
        error_log('[R2 BACKUP] Unable to persist the R2 folder setting.');
        return false;
    }
    @chmod(CCAS_R2_FOLDER_FILE, 0600);
    return true;
}

function ccas_r2_is_configured(): bool
{
    $configuration = ccas_r2_configuration();
    foreach (['account_id', 'access_key_id', 'secret_access_key', 'bucket'] as $key) {
        $value = $configuration[$key];
        if ($value === '') {
            return false;
        }
    }
    return ccas_r2_folder_prefix($configuration['folder']) !== null;
}

function ccas_r2_read_status(): array
{
    $status = [];
    if (is_file(CCAS_R2_STATUS_FILE)) {
        $savedStatus = json_decode((string)file_get_contents(CCAS_R2_STATUS_FILE), true);
        if (is_array($savedStatus)) {
            $status = $savedStatus;
        }
    }

    return [
        'configured' => ccas_r2_is_configured(),
        'folder' => ccas_r2_folder_prefix(ccas_r2_configuration()['folder']),
        'lastAttempt' => $status['lastAttempt'] ?? null,
        'lastSuccess' => $status['lastSuccess'] ?? null,
        'lastResult' => $status['lastResult'] ?? null,
        'message' => $status['message'] ?? null,
    ];
}

function ccas_r2_save_status(array $status): void
{
    if (!ccas_ensure_backup_directory()) {
        error_log('[R2 BACKUP] Unable to create status directory.');
        return;
    }

    $saved = @file_put_contents(
        CCAS_R2_STATUS_FILE,
        json_encode($status, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
        LOCK_EX
    );
    if ($saved === false) {
        error_log('[R2 BACKUP] Unable to save backup status.');
        return;
    }
    @chmod(CCAS_R2_STATUS_FILE, 0600);
}

function ccas_aws4_hmac(string $key, string $data): string
{
    return hash_hmac('sha256', $data, $key, true);
}

function ccas_r2_upload_file(string $filePath, string $objectKey, array $configuration): bool
{
    if (!extension_loaded('curl')) {
        error_log('[R2 BACKUP] PHP cURL extension is required for R2 uploads.');
        return false;
    }

    $host = $configuration['account_id'] . '.r2.cloudflarestorage.com';
    $encodedBucket = rawurlencode($configuration['bucket']);
    $encodedKey = implode('/', array_map('rawurlencode', explode('/', $objectKey)));
    $canonicalUri = '/' . $encodedBucket . '/' . $encodedKey;
    $url = 'https://' . $host . $canonicalUri;
    $payloadHash = hash_file('sha256', $filePath);
    if ($payloadHash === false) {
        error_log('[R2 BACKUP] Unable to hash backup file.');
        return false;
    }

    $amzDate = gmdate('Ymd\THis\Z');
    $date = gmdate('Ymd');
    $region = 'auto';
    $service = 's3';
    $scope = $date . '/' . $region . '/' . $service . '/aws4_request';
    $canonicalHeaders = "host:{$host}\n"
        . "x-amz-content-sha256:{$payloadHash}\n"
        . "x-amz-date:{$amzDate}\n";
    $signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    $canonicalRequest = "PUT\n{$canonicalUri}\n\n{$canonicalHeaders}\n{$signedHeaders}\n{$payloadHash}";
    $stringToSign = "AWS4-HMAC-SHA256\n{$amzDate}\n{$scope}\n" . hash('sha256', $canonicalRequest);

    $dateKey = ccas_aws4_hmac('AWS4' . $configuration['secret_access_key'], $date);
    $regionKey = ccas_aws4_hmac($dateKey, $region);
    $serviceKey = ccas_aws4_hmac($regionKey, $service);
    $signingKey = ccas_aws4_hmac($serviceKey, 'aws4_request');
    $signature = hash_hmac('sha256', $stringToSign, $signingKey);
    $authorization = 'AWS4-HMAC-SHA256 Credential=' . $configuration['access_key_id'] . '/' . $scope
        . ', SignedHeaders=' . $signedHeaders . ', Signature=' . $signature;

    $handle = @fopen($filePath, 'rb');
    if ($handle === false) {
        error_log('[R2 BACKUP] Unable to open backup file for upload.');
        return false;
    }

    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_UPLOAD => true,
        CURLOPT_INFILE => $handle,
        CURLOPT_INFILESIZE => filesize($filePath),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: ' . $authorization,
            'x-amz-content-sha256: ' . $payloadHash,
            'x-amz-date: ' . $amzDate,
            'Content-Type: application/sql',
        ],
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 300,
        CURLOPT_CAINFO => CCAS_R2_CA_BUNDLE,
    ]);
    $response = curl_exec($curl);
    $httpStatus = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);
    fclose($handle);

    if ($response === false || $httpStatus < 200 || $httpStatus >= 300) {
        error_log('[R2 BACKUP] Upload failed (HTTP ' . $httpStatus . '): ' . ($curlError ?: 'R2 rejected the request.'));
        return false;
    }

    return true;
}

function ccas_r2_upload_backups(string $archivePath, string $latestPath): bool
{
    $configuration = ccas_r2_configuration();
    if (!ccas_r2_is_configured()) {
        error_log('[R2 BACKUP] R2 settings are incomplete or CIMS_R2_FOLDER is invalid.');
        return false;
    }

    $attemptedAt = date(DATE_ATOM);
    $folder = ccas_r2_folder_prefix($configuration['folder']);
    if ($folder === null) {
        return false;
    }
    $archiveKey = $folder . '/archive/' . basename($archivePath);
    $latestKey = $folder . '/' . basename($latestPath);
    $archiveUploaded = ccas_r2_upload_file($archivePath, $archiveKey, $configuration);
    $latestUploaded = $archiveUploaded && ccas_r2_upload_file($latestPath, $latestKey, $configuration);
    $previousStatus = ccas_r2_read_status();

    $status = [
        'lastAttempt' => $attemptedAt,
        'lastSuccess' => $archiveUploaded && $latestUploaded ? $attemptedAt : $previousStatus['lastSuccess'],
        'lastResult' => $archiveUploaded && $latestUploaded ? 'success' : 'failed',
        'message' => $archiveUploaded && $latestUploaded
            ? 'Latest and timestamped backups uploaded.'
            : 'Upload failed. Check the PHP error log and R2 settings.',
    ];
    ccas_r2_save_status($status);

    return $archiveUploaded && $latestUploaded;
}

function ccas_ensure_backup_directory(): bool
{
    if (is_dir(CCAS_BACKUP_DIRECTORY)) {
        return true;
    }

    return @mkdir(CCAS_BACKUP_DIRECTORY, 0775, true) || is_dir(CCAS_BACKUP_DIRECTORY);
}

function triggerAutoBackup(PDO $connection): bool
{
    if (!ccas_ensure_backup_directory()) {
        error_log('[BACKUP] Unable to create ' . CCAS_BACKUP_DIRECTORY);
        return false;
    }

    $timestamp = date('Y_m_d_His');
    $latestPath = CCAS_BACKUP_DIRECTORY . '/transaction_backup_latest.json';
    $timestampedPath = CCAS_BACKUP_DIRECTORY . '/transaction_backup_' . $timestamp . '.json';
    $temporaryPath = CCAS_BACKUP_DIRECTORY . '/.transaction_backup_' . $timestamp . '.tmp.json';

    try {
        $connection->beginTransaction();
        $transactions = $connection->query('SELECT * FROM transactions ORDER BY timestamp, id')->fetchAll(PDO::FETCH_ASSOC);
        $transactionItems = $connection->query('SELECT * FROM transaction_items ORDER BY transaction_id, id')->fetchAll(PDO::FETCH_ASSOC);
        $connection->commit();
    } catch (Throwable $exception) {
        if ($connection->inTransaction()) {
            $connection->rollBack();
        }
        error_log('[BACKUP] Could not read transaction data: ' . $exception->getMessage());
        return false;
    }

    $backup = json_encode([
        'formatVersion' => 1,
        'createdAt' => date(DATE_ATOM),
        'database' => $connection->query('SELECT DATABASE()')->fetchColumn(),
        'transactions' => $transactions,
        'transactionItems' => $transactionItems,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($backup === false) {
        error_log('[BACKUP] Could not encode transaction data: ' . json_last_error_msg());
        return false;
    }

    if (@file_put_contents($temporaryPath, $backup, LOCK_EX) === false
        || !@copy($temporaryPath, $latestPath)
        || !@copy($temporaryPath, $timestampedPath)) {
        @unlink($temporaryPath);
        error_log('[BACKUP] Could not save latest or timestamped transaction backup.');
        return false;
    }
    @unlink($temporaryPath);

    if (ccas_r2_is_configured()) {
        ccas_r2_upload_backups($timestampedPath, $latestPath);
    }

    $cutoff = time() - (CCAS_BACKUP_RETENTION_DAYS * 86400);
    foreach (glob(CCAS_BACKUP_DIRECTORY . '/transaction_backup_*.json') ?: [] as $backupFile) {
        if (basename($backupFile) === 'transaction_backup_latest.json') {
            continue;
        }
        if (@filemtime($backupFile) !== false && filemtime($backupFile) < $cutoff) {
            @unlink($backupFile);
        }
    }

    return true;
}

function ccas_validate_database(PDO $connection): bool
{
    try {
        $connection->query('SELECT 1')->fetchColumn();
        $tableCount = (int)$connection->query('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()')->fetchColumn();
        return $tableCount > 0;
    } catch (Throwable $exception) {
        error_log('[CRITICAL] Database validation failed: ' . $exception->getMessage());
        return false;
    }
}

function ccas_connect_with_recovery(string $host, string $database, string $username, string $password): PDO
{
    $connect = static function () use ($host, $database, $username, $password): PDO {
        $connection = new PDO("mysql:host={$host};dbname={$database};charset=utf8mb4", $username, $password);
        $connection->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $connection->exec("SET time_zone = '+08:00'");
        return $connection;
    };

    try {
        $connection = $connect();
    } catch (Throwable $exception) {
        error_log('[CRITICAL] Database connection failed. Transaction backups contain data only and cannot restore the database schema.');
        throw $exception;
    }

    if (!ccas_validate_database($connection)) {
        throw new RuntimeException('Database validation failed. Transaction backups contain data only and cannot restore the database schema.');
    }

    return $connection;
}

function ccas_connect_and_validate(string $host, string $database, string $username, string $password): PDO
{
    return ccas_connect_with_recovery($host, $database, $username, $password);
}

function ccas_register_write_backup(PDO $connection, string $action, string $method): void
{
    $writeActions = ['checkout', 'transaction_delete'];

    if (!in_array($action, $writeActions, true) || !in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
        return;
    }

    register_shutdown_function(static function () use ($connection): void {
        if (http_response_code() >= 200 && http_response_code() < 300) {
            triggerAutoBackup($connection);
        }
    });
}
