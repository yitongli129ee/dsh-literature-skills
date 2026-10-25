# launch-chrome.ps1 — portable: auto-detect Chrome/Edge, optional proxy, CDP on 9222.
# Usage:
#   pwsh -File launch-chrome.ps1                     # no proxy (off-campus, no GFW)
#   pwsh -File launch-chrome.ps1 -Proxy http://127.0.0.1:7890
#   pwsh -File launch-chrome.ps1 -ChromePath "C:\...\chrome.exe"
param(
    [string]$Proxy = '',          # empty = direct; else e.g. http://127.0.0.1:7890
    [string]$Port = '9222',
    [string]$ChromePath = '',     # auto-detect if empty
    [string]$UserDataDir = ''     # default: the browser's real profile dir
)
$ErrorActionPreference = 'Stop'

# ---- 1) auto-detect a browser with CDP support ----
if ($ChromePath -and (Test-Path $ChromePath)) {
    $browser = $ChromePath
} else {
    $candidates = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
    )
    $browser = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if (-not $browser) {
        throw "Chrome/Edge not found in standard locations. Pass -ChromePath or install a browser."
    }
}
Write-Host "browser : $browser"

# ---- 2) user data dir (real profile, so logins carry over) ----
if (-not $UserDataDir) {
    if ($browser -match 'Chrome') { $UserDataDir = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data' }
    else                          { $UserDataDir = Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data' }
}
Write-Host "profile  : $UserDataDir"

# ---- 3) launch (explicit --user-data-dir is REQUIRED or Chrome ignores the CDP port) ----
$browserArgs = @("--remote-debugging-port=$Port", "--user-data-dir=$UserDataDir", '--remote-allow-origins=*')
if ($Proxy) {
    $browserArgs += "--proxy-server=$Proxy"
    Write-Host "proxy    : $Proxy"
} else {
    Write-Host "proxy    : (none, direct)"
}
$browserArgs += @('--no-first-run', 'about:blank')
Start-Process $browser -ArgumentList $browserArgs | Out-Null

Start-Sleep -Seconds 5
Write-Host "CDP status:"
curl.exe -s -m 8 "http://127.0.0.1:$Port/json/version"
