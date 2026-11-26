# Copies Lumiherd (layout + mods) into the Herdr app's home on Windows, as pasang.sh
# does on macOS and Linux (no rsync here). Herdr reloads them live.
#   powershell -ExecutionPolicy Bypass -File pasang.ps1
$ErrorActionPreference = "Stop"
$src = Join-Path $PSScriptRoot "lumiherd"
$home_ = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { Join-Path $env:USERPROFILE ".config\herdr-app" }
$hc = Join-Path $env:LOCALAPPDATA "Programs\herdr-core\hc.exe"
$app = Join-Path $env:LOCALAPPDATA "Programs\herdr-app\herdr-app.exe"
if (-not (Test-Path $hc)) { $hc = (Get-Command hc -ErrorAction SilentlyContinue).Source }
if (-not (Test-Path $app)) { $app = (Get-Command herdr-app -ErrorAction SilentlyContinue).Source }

# The small shell under the right panel shows the terminal named lumi-shell. Herdr drops
# a terminal block whose terminal is gone, so start it first. It loops: `exit` gives a
# fresh PowerShell.
if ($hc) {
  & $hc get lumi-shell *> $null
  if ($LASTEXITCODE -ne 0) {
    & $hc run --bg --no-notify --no-parent --keep --name lumi-shell --cwd "$env:USERPROFILE" -- powershell -NoLogo -Command "while (`$true) { powershell -NoLogo }" | Out-Null
  }
}

foreach ($d in @("mods", "layouts", "imul", "brand")) { New-Item -ItemType Directory -Force (Join-Path $home_ $d) | Out-Null }
Copy-Item (Join-Path $src "mods\*") (Join-Path $home_ "mods") -Recurse -Force
Copy-Item (Join-Path $src "layouts\*") (Join-Path $home_ "layouts") -Recurse -Force
# Imul, Lumi's little robot, as the agents' icon (a helmet colour per agent). Its
# programs.json goes in only when there is none: one of your own is never replaced.
Copy-Item (Join-Path $src "imul\*.png") (Join-Path $home_ "imul") -Force
if (-not (Test-Path (Join-Path $home_ "programs.json"))) { Copy-Item (Join-Path $src "imul\programs.json") (Join-Path $home_ "programs.json") }
# The brand row's picture (Lumi), when you haven't put one of your own.
if (-not (Test-Path (Join-Path $home_ "brand\lumiherd.png"))) { Copy-Item (Join-Path $src "brand\lumiherd.png") (Join-Path $home_ "brand\lumiherd.png") }

# Check each mod (needs the desktop: skipped over ssh, where Herdr can't open a window).
if ($app -and [Environment]::UserInteractive -and -not $env:SSH_CONNECTION) {
  Get-ChildItem (Join-Path $src "mods") -Directory | ForEach-Object {
    & $app check (Join-Path $home_ "mods\$($_.Name)") *> $null
    if ($LASTEXITCODE -ne 0) { "check failed: $($_.Name)" }
  }
}
# Panels from other repos (Herdr-Roundup, munza/herdr-mods): not in this one.
foreach ($m in @("roundup-files", "roundup-preview", "better-changes")) {
  if (-not (Test-Path (Join-Path $home_ "mods\$m"))) { "missing ${m}: the Files/Changes panels need Herdr-Roundup's mods/$m (roundup-*) or munza/herdr-mods' (better-changes) in $home_\mods" }
}
"Lumiherd installed in $home_ (switch: herdr-app do layout.switch '{`"name`":`"lumiherd`"}')"
