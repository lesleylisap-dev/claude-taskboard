$ErrorActionPreference = "Stop"
$root = "C:\Users\I327394\projects\claude-taskboard"
$vsix = "$root\claude-taskboard-0.1.0.vsix"

# Auto-generate manifest files if missing (gitignored, regenerated each build)
$manifest = "$root\extension.vsixmanifest"
if (-not (Test-Path $manifest)) {
    Set-Content $manifest @'
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="claude-taskboard" Version="0.1.0" Publisher="lesleylisap-dev" />
    <DisplayName>Claude 任务板</DisplayName>
    <Description xml:space="preserve">管理 Claude Code 对话，按任务组织 sessions，支持归档和快速续接</Description>
    <Tags>claude,taskboard</Tags>
    <Categories>Other</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.85.0" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
  </Assets>
</PackageManifest>
'@
}
$contentTypes = "$root\[Content_Types].xml"
if (-not (Test-Path -LiteralPath $contentTypes)) {
    Set-Content -LiteralPath $contentTypes @'
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".vsixmanifest" ContentType="text/xml" />
  <Default Extension=".json" ContentType="application/json" />
  <Default Extension=".js" ContentType="application/javascript" />
  <Default Extension=".css" ContentType="text/css" />
  <Default Extension=".svg" ContentType="image/svg+xml" />
  <Default Extension=".md" ContentType="text/markdown" />
  <Default Extension=".png" ContentType="image/png" />
</Types>
'@
}

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
Copy-Item -LiteralPath "$root\[Content_Types].xml" "$tmp\[Content_Types].xml"

# Zip everything
if (Test-Path $vsix) { Remove-Item $vsix }
Add-Type -Assembly "System.IO.Compression.FileSystem"
[System.IO.Compression.ZipFile]::CreateFromDirectory($tmp, $vsix)
Remove-Item -Recurse -Force $tmp

Write-Host "Created: $vsix" -ForegroundColor Green
Write-Host "Size: $([math]::Round((Get-Item $vsix).Length/1KB, 1)) KB" -ForegroundColor Cyan
