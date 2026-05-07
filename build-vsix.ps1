$ErrorActionPreference = "Stop"
$root = "C:\Users\I327394\projects\claude-taskboard"
$vsix = "$root\claude-taskboard-0.1.0.vsix"

# Build the extension directory structure inside a temp folder
$tmp = "$env:TEMP\vsix-build-$(Get-Random)"
$extDir = "$tmp\extension"

New-Item -ItemType Directory -Force -Path $extDir | Out-Null
New-Item -ItemType Directory -Force -Path "$extDir\out" | Out-Null
New-Item -ItemType Directory -Force -Path "$extDir\media" | Out-Null
New-Item -ItemType Directory -Force -Path "$extDir\.vscode" | Out-Null

# Copy files
Copy-Item "$root\package.json"           "$extDir\package.json"
Copy-Item "$root\README.md"              "$extDir\README.md"
Copy-Item "$root\out\extension.js"       "$extDir\out\extension.js"
Copy-Item "$root\out\ConversationReader.js" "$extDir\out\ConversationReader.js"
Copy-Item "$root\out\Storage.js"         "$extDir\out\Storage.js"
Copy-Item "$root\out\TaskBoardProvider.js" "$extDir\out\TaskBoardProvider.js"
Copy-Item "$root\media\main.js"          "$extDir\media\main.js"
Copy-Item "$root\media\style.css"        "$extDir\media\style.css"
Copy-Item "$root\media\icon.svg"         "$extDir\media\icon.svg"

# Copy manifest files to root of zip
Copy-Item "$root\extension.vsixmanifest" "$tmp\extension.vsixmanifest"
Copy-Item "$root\[Content_Types].xml"    "$tmp\[Content_Types].xml"

# Zip everything
if (Test-Path $vsix) { Remove-Item $vsix }
Add-Type -Assembly "System.IO.Compression.FileSystem"
[System.IO.Compression.ZipFile]::CreateFromDirectory($tmp, $vsix)
Remove-Item -Recurse -Force $tmp

Write-Host "Created: $vsix" -ForegroundColor Green
Write-Host "Size: $([math]::Round((Get-Item $vsix).Length/1KB, 1)) KB" -ForegroundColor Cyan
