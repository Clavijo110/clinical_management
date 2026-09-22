$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $root 'backend'
$frontendPath = Join-Path $root 'frontend'

function Ensure-Dependencies {
  param([string]$Path)

  if (-not (Test-Path (Join-Path $Path 'node_modules'))) {
    Write-Host "Instalando dependencias en $Path ..." -ForegroundColor Yellow
    Push-Location $Path
    try {
      & npm.cmd install
      if ($LASTEXITCODE -ne 0) { throw "npm install fallo en $Path" }
    } finally {
      Pop-Location
    }
  }
}

Ensure-Dependencies $backendPath
Ensure-Dependencies $frontendPath

$env:PORT = '4001'
$env:VITE_API_URL = 'http://localhost:4001/api'

$backend = Start-Process -FilePath 'npm.cmd' -ArgumentList @('--prefix', $backendPath, 'run', 'dev') -WorkingDirectory $root -PassThru
$frontend = Start-Process -FilePath 'npm.cmd' -ArgumentList @('--prefix', $frontendPath, 'run', 'dev') -WorkingDirectory $root -PassThru

Write-Host ''
Write-Host 'Sistema de Gestion Clinica UV iniciado.' -ForegroundColor Green
Write-Host 'Frontend: http://localhost:5173' -ForegroundColor Cyan
Write-Host 'Backend:  http://localhost:4001/api/health' -ForegroundColor Cyan
Write-Host 'Presiona Ctrl+C para detener ambos servicios.' -ForegroundColor DarkGray
Write-Host ''

try {
  Wait-Process -Id $backend.Id
} finally {
  if (-not $backend.HasExited) { Stop-Process -Id $backend.Id -Force }
  if (-not $frontend.HasExited) { Stop-Process -Id $frontend.Id -Force }
}
