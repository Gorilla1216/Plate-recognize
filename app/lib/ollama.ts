type Message = {
  role: string;
  content: string | Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >;
};

export async function ollamaChat({ messages, max_tokens, json = false }: {
  messages: Message[];
  max_tokens: number;
  json?: boolean;
}) {
  const model = process.env.OLLAMA_MODEL || "qwen3.5:4b";
  const gatewayUrl = process.env.OLLAMA_GATEWAY_URL?.trim();
  const gatewayToken = process.env.OLLAMA_GATEWAY_TOKEN?.trim();
  if (gatewayUrl && (!gatewayToken || gatewayToken.length < 32)) {
    throw Object.assign(new Error("Configure OLLAMA_GATEWAY_TOKEN in the hosting environment."), { status: 503 });
  }
  if (gatewayUrl) {
    let valid = false;
    try {
      const url = new URL(gatewayUrl);
      valid = url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
    } catch { /* Report a configuration error without exposing credentials. */ }
    if (!valid) throw Object.assign(new Error("OLLAMA_GATEWAY_URL must be a valid HTTPS URL without credentials or query parameters."), { status: 503 });
  }
  if (!gatewayUrl && (process.env.VERCEL || process.env.NETLIFY)) {
    throw Object.assign(new Error("Configure OLLAMA_GATEWAY_URL and OLLAMA_GATEWAY_TOKEN to connect to your PC."), { status: 503 });
  }
  const baseUrl = gatewayUrl || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const timeout = Number(process.env.OLLAMA_TIMEOUT_MS) || (gatewayUrl ? 55_000 : 300_000);
  const converted = messages.map((message) => {
    if (typeof message.content === "string") return message;
    const images: string[] = [];
    const text: string[] = [];
    for (const part of message.content) {
      if (part.type === "text") text.push(part.text);
      else {
        const match = /^data:image\/(?:jpeg|png);base64,(.+)$/.exec(part.image_url.url);
        if (!match) throw Object.assign(new Error("Зургийн формат буруу байна."), { status: 400 });
        images.push(match[1]);
      }
    }
    return { role: message.role, content: text.join("\n"), ...(images.length ? { images } : {}) };
  });
  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(gatewayUrl ? { Authorization: `Bearer ${gatewayToken}` } : {}) },
      body: JSON.stringify({
        model, messages: converted, stream: false,
        ...(model.startsWith("qwen") ? { think: false } : {}),
        ...(json ? { format: "json" } : {}),
        options: { num_predict: max_tokens, num_ctx: 4096, temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(timeout),
      redirect: "error",
    });
  } catch (error) {
    const timedOut = error instanceof Error && /timeout|abort/i.test(error.name);
    throw Object.assign(new Error(timedOut
      ? "Ollama хариулах хугацаа дууслаа. Дахин оролдоно уу."
      : "Ollama ажиллахгүй байна. Ollama-г асаагаад дахин оролдоно уу."), { status: timedOut ? 504 : 503 });
  }
  const data = await response.json() as { error?: string; message?: { content?: string } };
  if (!response.ok) {
    if (gatewayUrl) {
      throw Object.assign(new Error(response.status === 401
        ? "Backend authentication failed. Check OLLAMA_GATEWAY_TOKEN."
        : data.error || "The local AI backend is unavailable."), { status: response.status });
    }
    throw Object.assign(new Error(response.status === 404
      ? `Модель олдсонгүй. Терминалд ollama pull ${model} ажиллуулна уу.`
      : data.error || "Ollama хүсэлт амжилтгүй боллоо."), { status: 503 });
  }
  const text = data.message?.content?.trim();
  if (!text) throw Object.assign(new Error("Модель хоосон хариу өглөө."), { status: 502 });
  return text;
}
