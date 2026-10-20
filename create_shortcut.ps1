# PowerShell script to create a Windows shortcut with custom icon
# Run this script as administrator if needed

$WshShell = New-Object -ComObject WScript.Shell

# Get the current directory
$currentDir = Get-Location

# Create shortcut on Desktop
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcut = $WshShell.CreateShortcut("$desktop\CCAS MOBITRACK.lnk")

# Set the shortcut properties
$shortcut.TargetPath = "$currentDir\CHOOSE_Inventory_System.bat"
$shortcut.WorkingDirectory = "$currentDir"
$shortcut.Description = "Launch CCAS MOBITRACK"

# Convert PNG to ICO if it doesn't exist
$icoPath = "$currentDir\CHOOSE_logo.ico"
$pngPath = "$currentDir\CHOOSE_logo.png"

if (-not (Test-Path $icoPath) -and (Test-Path $pngPath)) {
    Write-Host "Converting CHOOSE_logo.png to CHOOSE_logo.ico..."
    Add-Type -AssemblyName System.Drawing
    $image = [System.Drawing.Image]::FromFile($pngPath)

    # Create ICO file
    $bitmap = New-Object System.Drawing.Bitmap(256, 256)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.DrawImage($image, 0, 0, 256, 256)

    # Save as ICO using memory stream
    $memoryStream = New-Object System.IO.MemoryStream
    $binaryWriter = New-Object System.IO.BinaryWriter($memoryStream)

    # ICO header
    $binaryWriter.Write([UInt16]0)      # Reserved
    $binaryWriter.Write([UInt16]1)      # Type: 1 = ICO
    $binaryWriter.Write([UInt16]1)      # Number of images

    # Image directory entry
    $binaryWriter.Write([Byte]0)        # Width: 0 = 256px
    $binaryWriter.Write([Byte]0)        # Height: 0 = 256px
    $binaryWriter.Write([Byte]0)        # Color palette: 0 = no palette
    $binaryWriter.Write([Byte]0)        # Reserved
    $binaryWriter.Write([UInt16]1)      # Color planes: 1
    $binaryWriter.Write([UInt16]32)     # Bits per pixel: 32
    $bitmapStream = New-Object System.IO.MemoryStream
    $bitmap.Save($bitmapStream, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmapBytes = $bitmapStream.ToArray()
    $binaryWriter.Write([UInt32]$bitmapBytes.Length)   # Size of image data
    $binaryWriter.Write([UInt32]22)                     # Offset to image data (6 + 16)

    # Image data (PNG)
    $binaryWriter.Write($bitmapBytes)

    # Save to file
    [System.IO.File]::WriteAllBytes($icoPath, $memoryStream.ToArray())

    $image.Dispose()
    $bitmap.Dispose()
    $graphics.Dispose()

    Write-Host "Successfully converted PNG to ICO!"
}

# Set icon if ICO file exists
if (Test-Path $icoPath) {
    $shortcut.IconLocation = "$icoPath, 0"
    Write-Host "Shortcut icon set to CHOOSE_logo.ico"
}

# Save the shortcut
$shortcut.Save()

Write-Host ""
Write-Host "========================================="
Write-Host "SUCCESS! Shortcut created on Desktop."
Write-Host "You can now double-click 'CCAS MOBITRACK' to launch the app!"
Write-Host "========================================="