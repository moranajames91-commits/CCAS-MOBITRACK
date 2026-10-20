[CmdletBinding()]
param(
    [ValidateSet('Monitor', 'Check', 'Sync')]
    [string]$Mode = 'Monitor',
    [string]$SourceRoot = $PSScriptRoot,
    [string]$BackupRoot = 'D:\CCAS_SYSTEM_BACKUPS',
    [int]$IntervalSeconds = 15
)

$ErrorActionPreference = 'Stop'
$ManifestPath = Join-Path $BackupRoot 'ccas_file_manifest.json'
$StatePath = Join-Path $BackupRoot 'ccas_engine_state.json'
$LogPath = Join-Path $BackupRoot 'ccas_engine.log'
$ExcludedDirectories = @('node_modules', 'dist', '.git', '.vite')
$ExcludedFiles = @('*.tmp', '*.log', 'desktop.ini')

function Write-EngineLog {
    param([string]$Message, [string]$Level = 'INFO')
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [$Level] $Message"
    try { Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8 } catch {}
    Write-Host $line
}

function Ensure-BackupRoot {
    if (-not (Test-Path -LiteralPath $BackupRoot)) {
        New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
    }
}

function Get-RelativePath {
    param([string]$FullPath)
    $root = ([IO.Path]::GetFullPath($SourceRoot)).TrimEnd('\') + '\'
    return $FullPath.Substring($root.Length).Replace('\', '/')
}

function Test-IncludedFile {
    param([IO.FileInfo]$File)
    foreach ($excludedDirectory in $ExcludedDirectories) {
        if ($File.FullName -split '[\\/]' -contains $excludedDirectory) { return $false }
    }
    foreach ($excludedFile in $ExcludedFiles) {
        if ($File.Name -like $excludedFile) { return $false }
    }
    return $true
}

function Get-SourceManifest {
    $items = @{}
    if (-not (Test-Path -LiteralPath $SourceRoot)) { throw "Source folder does not exist: $SourceRoot" }

    Get-ChildItem -LiteralPath $SourceRoot -File -Recurse -Force | Where-Object { Test-IncludedFile $_ } | ForEach-Object {
        $relative = Get-RelativePath $_.FullName
        $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        $items[$relative] = [ordered]@{
            Hash = $hash
            Length = $_.Length
            LastWriteUtc = $_.LastWriteTimeUtc.ToString('o')
        }
    }
    return $items
}

function Get-BackupPath {
    param([string]$RelativePath)
    $safePath = $RelativePath.Replace('/', '\')
    return Join-Path $BackupRoot (Join-Path 'mirror' $safePath)
}

function Save-JsonState {
    param([hashtable]$Manifest)
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8
    [ordered]@{
        SourceRoot = $SourceRoot
        BackupRoot = $BackupRoot
        LastSync = (Get-Date).ToUniversalTime().ToString('o')
        FileCount = $Manifest.Count
        EngineVersion = '1.0'
    } | ConvertTo-Json | Set-Content -LiteralPath $StatePath -Encoding UTF8
}

function Sync-SourceToBackup {
    Ensure-BackupRoot
    $sourceManifest = Get-SourceManifest
    $copied = 0

    foreach ($relative in $sourceManifest.Keys) {
        $sourcePath = Join-Path $SourceRoot ($relative.Replace('/', '\'))
        $backupPath = Get-BackupPath $relative
        $backupDirectory = Split-Path -Parent $backupPath
        if (-not (Test-Path -LiteralPath $backupDirectory)) {
            New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
        }

        $needsCopy = -not (Test-Path -LiteralPath $backupPath)
        if (-not $needsCopy) {
            $backupHash = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash
            $needsCopy = $backupHash -ne $sourceManifest[$relative].Hash
        }
        if ($needsCopy) {
            Copy-Item -LiteralPath $sourcePath -Destination $backupPath -Force
            $copied++
        }
    }

    Save-JsonState $sourceManifest
    Write-EngineLog "Drive D sync complete. Files checked: $($sourceManifest.Count); files copied: $copied."
    return $sourceManifest
}

function Restore-FromBackup {
    Ensure-BackupRoot
    if (-not (Test-Path -LiteralPath $ManifestPath)) {
        Write-EngineLog 'No file manifest found on Drive D; automatic file recovery skipped.' 'WARN'
        return $false
    }

    $manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    $restored = 0
    $failed = 0
    foreach ($property in $manifest.PSObject.Properties) {
        $relative = $property.Name
        $expected = $property.Value
        $sourcePath = Join-Path $SourceRoot ($relative.Replace('/', '\'))
        $backupPath = Get-BackupPath $relative
        $needsRestore = -not (Test-Path -LiteralPath $sourcePath)
        if (-not $needsRestore) {
            try { $needsRestore = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash -ne $expected.Hash } catch { $needsRestore = $true }
        }
        if ($needsRestore) {
            if (-not (Test-Path -LiteralPath $backupPath)) { $failed++; continue }
            try {
                $directory = Split-Path -Parent $sourcePath
                if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
                Copy-Item -LiteralPath $backupPath -Destination $sourcePath -Force
                $restored++
            } catch { $failed++ }
        }
    }

    if ($failed -gt 0) { Write-EngineLog "Recovery finished with failures. Restored: $restored; failed: $failed." 'WARN' }
    else { Write-EngineLog "Recovery check complete. Files restored: $restored." }
    return $failed -eq 0
}

function Start-FileMonitor {
    Ensure-BackupRoot
    $watcher = New-Object IO.FileSystemWatcher $SourceRoot -Property @{ IncludeSubdirectories = $true; EnableRaisingEvents = $true; NotifyFilter = [IO.NotifyFilters]'FileName, LastWrite, Size, CreationTime' }
    $action = { Sync-SourceToBackup | Out-Null }
    Register-ObjectEvent $watcher Created -Action $action | Out-Null
    Register-ObjectEvent $watcher Changed -Action $action | Out-Null
    Register-ObjectEvent $watcher Renamed -Action $action | Out-Null
    Register-ObjectEvent $watcher Deleted -Action $action | Out-Null

    Write-EngineLog "Dual-drive monitor started. Source: $SourceRoot; Backup: $BackupRoot; Interval: ${IntervalSeconds}s."
    try {
        while ($true) {
            Start-Sleep -Seconds $IntervalSeconds
            Sync-SourceToBackup | Out-Null
        }
    } finally {
        Unregister-Event -SourceIdentifier * -ErrorAction SilentlyContinue
        $watcher.Dispose()
    }
}

try {
    Ensure-BackupRoot
    if ($Mode -eq 'Check') {
        Restore-FromBackup | Out-Null
        exit 0
    }
    if ($Mode -eq 'Sync') {
        Sync-SourceToBackup | Out-Null
        exit 0
    }

    # Startup recovery runs before the app launcher starts the frontend.
    Restore-FromBackup | Out-Null
    Sync-SourceToBackup | Out-Null
    Start-FileMonitor
} catch {
    Write-EngineLog $_.Exception.Message 'CRITICAL'
    exit 1
}
