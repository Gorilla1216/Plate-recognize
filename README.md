# Food Scan

Mongolian food AI app with the frontend from [Toka-1/ai-image](https://github.com/Toka-1/ai-image), using local Ollama for food-photo analysis, ingredient recognition, and chat.

## Run

Install [Ollama](https://ollama.com/download/windows), start it, then:

```powershell
ollama pull qwen3.5:4b
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:3000. No paid AI API keys are required. Image generation requires a separate local image-generation model and is currently unavailable.

See [SETUP.md](SETUP.md) for configuration, checks, and a temporary public demo using your PC and Cloudflare Tunnel.

For hosted deployment with authenticated access to your PC's Ollama, see [BACKEND_DEPLOYMENT.md](BACKEND_DEPLOYMENT.md).
