# Food Scan with Ollama

Frontend reproduced from https://github.com/Toka-1/ai-image at commit `d0fb9f047687b58d2319429bd9bc97fcc3ac74b7`. The Mongolian interface, styles, tabs, theme toggle, and chat are preserved.

Photo analysis, ingredient recognition, and chat use local Ollama. No Hugging Face or Gemini keys or API credits are needed for these features. The selected model does not generate images; that tab explains the limitation without calling paid providers.
AI answers use English, as the small local models tested produced unreliable Mongolian. The frontend remains in Mongolian. The default model is Qwen 3.5 4B.

## Local setup

1. Install Ollama from https://ollama.com/download/windows and start it.
2. Download the vision model: `ollama pull qwen3.5:4b` (several GB).
3. Run `npm.cmd ci`, then `npm.cmd run dev`.
4. Open http://localhost:3000.

Optional server-only `.env.local` settings (defaults shown):

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.5:4b
```

Keep existing API keys private; they are no longer used by these routes. Never commit `.env.local`.

## Free demo using your PC

The app and Ollama run on your PC. Cloudflare Quick Tunnel shares only the web app through a temporary HTTPS URL; Ollama stays on loopback. Your PC must stay awake and online. The URL changes on each launch and stops working when the tunnel stops. This is a demo, not permanent hosting.

With Ollama running and `tools/cloudflared.exe` downloaded from the official Cloudflare release, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-demo.ps1
```

The script builds the app, starts a production server on port 3001, and prints a `trycloudflare.com` URL. Keep the terminal open; Ctrl+C stops the demo. Logs are in the ignored `logs/` folder. The demo URL is accessible to anyone who has it.

Free local inference uses your hardware and electricity. CPU-only responses can take minutes. Long image analysis requests may exceed the tunnel's upstream timeout even if local processing succeeds.

## Verification

```powershell
node --test scripts/test-ollama.mjs
npx.cmd tsc --noEmit
npm.cmd run build
```

The ignored `reference/` folder contains the unmodified upstream checkout.
