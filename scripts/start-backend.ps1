$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$tunnelPath = Join-Path (Get-Location) 'tools/cloudflared.exe'
if (-not (Test-Path -LiteralPath $tunnelPath)) { throw 'Download tools/cloudflared.exe first.' }
$models = Invoke-RestMethod -Uri http://127.0.0.1:11434/api/tags
if (-not ($models.models.name -contains 'qwen3.5:4b')) { throw 'Run ollama pull qwen3.5:4b first.' }
& node scripts/setup-backend.mjs
if ($LASTEXITCODE -ne 0) { throw 'Backend configuration failed.' }
New-Item -ItemType Directory -Path logs -Force | Out-Null
$gatewayProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList '--env-file=.env.gateway.local','scripts/ollama-gateway.mjs' -WindowStyle Hidden -PassThru -RedirectStandardOutput 'logs/gateway.log' -RedirectStandardError 'logs/gateway-error.log'
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if ($gatewayProcess.HasExited) { throw 'Gateway exited. Check logs/gateway-error.log.' }
        try {
            Invoke-RestMethod -Uri http://127.0.0.1:11435/health | Out-Null
            $ready = $true
            break
        } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { throw 'Gateway did not become ready.' }
    Write-Host 'Keep this terminal open. Set the HTTPS URL below as OLLAMA_GATEWAY_URL in Vercel/Netlify.'
    Write-Host 'Copy OLLAMA_GATEWAY_TOKEN from .env.gateway.local into the hosting environment. Never expose it to browser code.'
    & $tunnelPath tunnel --url http://127.0.0.1:11435 --no-autoupdate
} finally {
    if (-not $gatewayProcess.HasExited) { Stop-Process -Id $gatewayProcess.Id }
}
