# Publica una actualización de Al Día en GitHub Pages.
# Uso (en PowerShell, dentro de esta carpeta):  .\publicar.ps1 "qué cambió"
# 1) Sube la versión del service worker (v1 -> v2 ...), 2) commit, 3) push.
# Los teléfonos con la app instalada verán "Hay una nueva versión" al abrirla.
param([string]$Mensaje = "Actualización")

Set-Location -Path $PSScriptRoot
$sw = Join-Path $PSScriptRoot 'sw.js'
$texto = [System.IO.File]::ReadAllText($sw)
if ($texto -match "const VERSION = 'v(\d+)';") {
  $nueva = [int]$Matches[1] + 1
  $texto = $texto -replace "const VERSION = 'v\d+';", "const VERSION = 'v$nueva';"
  [System.IO.File]::WriteAllText($sw, $texto, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "Versión nueva: v$nueva"
} else {
  Write-Host "No encontré la línea VERSION en sw.js" -ForegroundColor Red
  exit 1
}

git add -A
git commit -m "v${nueva}: $Mensaje"
git push
Write-Host "Listo. GitHub Pages tarda 1 a 2 minutos en publicar." -ForegroundColor Green
