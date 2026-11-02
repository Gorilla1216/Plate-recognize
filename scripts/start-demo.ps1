$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$tunnelPath = Join-Path (Get-Location) 'tools/cloudflared.exe'
if (-not (Test-Path -LiteralPath $tunnelPath)) {
    throw 'Missing tools/cloudflared.exe. Download cloudflared from Cloudflare first.'
}
try {
    Invoke-RestMethod -Uri http://127.0.0.1:11434/api/tags | Out-Null
} catch {
    throw 'Start Ollama and run ollama pull qwen3.5:4b first.'
}
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Production build failed.' }
New-Item -ItemType Directory -Path logs -Force | Out-Null
$webProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList 'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3001' -WindowStyle Hidden -PassThru -RedirectStandardOutput 'logs/demo-web.log' -RedirectStandardError 'logs/demo-web-error.log'
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($webProcess.HasExited) { throw 'Web server exited. See logs/demo-web-error.log.' }
        try {
            Invoke-WebRequest -Uri http://127.0.0.1:3001 -UseBasicParsing | Out-Null
            $ready = $true
            break
        } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { throw 'Web server did not become ready.' }
    Write-Host 'Keep this terminal open. Share the trycloudflare.com URL below. Ctrl+C stops the demo.'
    & $tunnelPath tunnel --url http://127.0.0.1:3001
} finally {
    if (-not $webProcess.HasExited) { Stop-Process -Id $webProcess.Id }
}
