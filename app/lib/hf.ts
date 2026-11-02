import { InferenceClient, type InferenceProvider } from "@huggingface/inference";
import { NextResponse } from "next/server";

type ChatMessage = {
  content?: unknown;
  reasoning_content?: unknown;
};

type HfErrorBody = {
  error?: { message?: string } | string;
  choices?: Array<{ message?: ChatMessage }>;
};

export function getHfToken() {
  const token = process.env.HF_TOKEN;

  if (!token) {
    throw Object.assign(new Error(".env.local дотор HF_TOKEN байхгүй байна."), {
      status: 500,
    });
  }

  if (token.length < 20 || token.includes("xxxx") || token.includes("...")) {
    throw Object.assign(
      new Error(
        "HF_TOKEN жишээ утга байна. Hugging Face-ийн бүтэн token-оо .env.local-д хийгээд npm run dev-ийг дахин асаана уу.",
      ),
      { status: 401 },
    );
  }

  return token;
}

export function extractText(message: ChatMessage | undefined) {
  if (!message) return "";

  const { content } = message;

  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }

  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        const item = part as {
          text?: unknown;
          thought?: unknown;
          type?: unknown;
        };
        if (item.thought === true) return "";
        if (item.type === "reasoning" || item.type === "thinking") return "";
        return String(item.text ?? "");
      })
      .join("\n")
      .trim();
    if (joined) return joined;
  }

  return "";
}

export function stripThink(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\|think\|>[\s\S]*?<\|\/think\|>/gi, "")
    .trim();
}

function cyrillicRatio(text: string) {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (!letters) return 0;
  const cyrillic = letters.match(/\p{Script=Cyrillic}/gu)?.length ?? 0;
  return cyrillic / letters.length;
}

export function cleanFinalAnswer(text: string) {
  const cleaned = stripThink(text);
  const lines = cleaned.split("\n");
  const kept = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (cyrillicRatio(trimmed) >= 0.45) return true;
    if (/^[-•*]\s/.test(trimmed) && /[\u0400-\u04FF]/.test(trimmed)) return true;
    return false;
  });

  const result = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return result || cleaned;
}

export async function hfChat({
  model,
  messages,
  max_tokens,
  extra,
}: {
  model: string;
  messages: unknown[];
  max_tokens: number;
  extra?: Record<string, unknown>;
}) {
  const token = getHfToken();

  const response = await fetch(
    "https://router.huggingface.co/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens,
        ...extra,
      }),
    },
  );

  const data = (await response.json()) as HfErrorBody;

  if (!response.ok) {
    const raw =
      typeof data.error === "string"
        ? data.error
        : data.error?.message || `Hugging Face хүсэлт амжилтгүй боллоо (${response.status})`;

    const message =
      response.status === 401
        ? "Hugging Face token буруу байна. Шинэ token хуулаад .env.local-д хийж серверийг дахин асаана уу."
        : raw;

    throw Object.assign(new Error(message), { status: response.status });
  }

  const text = cleanFinalAnswer(extractText(data.choices?.[0]?.message));

  if (!text) {
    throw Object.assign(new Error("Модель хоосон хариу өглөө."), {
      status: 502,
    });
  }

  return text;
}

export function errorResponse(error: unknown) {
  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status?: number }).status) || 500
      : 500;
  const message = error instanceof Error ? error.message : "Хүсэлт амжилтгүй боллоо";
  return NextResponse.json({ error: message }, { status });
}

const IMAGE_MODEL = "black-forest-labs/FLUX.1-schnell";
const IMAGE_PROVIDERS: InferenceProvider[] = ["nscale", "fal-ai"];

const exhaustedUntil = new Map<string, number>();
const EXHAUST_MS = 6 * 60 * 60 * 1000;

function isQuotaError(status: number, message: string) {
  if ([402, 429].includes(status)) return true;
  return /rate|limit|quota|credit|exhausted|too many|payment|budget|daily/i.test(
    message,
  );
}

function isDeprecated(status: number, message: string) {
  if (status === 410) return true;
  return /deprecated|no longer supported/i.test(message);
}

function isUnsupported(status: number, message: string) {
  if ([400, 404].includes(status)) return true;
  return /not supported|no mapping|unavailable|does not support/i.test(message);
}

function isSkipped(id: string) {
  const until = exhaustedUntil.get(id) ?? 0;
  if (Date.now() >= until) {
    exhaustedUntil.delete(id);
    return false;
  }
  return true;
}

function getErrorInfo(error: unknown) {
  const fallback = error instanceof Error ? error.message : "Зураг үүсгэж чадсангүй";
  if (!error || typeof error !== "object") {
    return { status: 500, message: fallback };
  }

  const http = (
    error as {
      httpResponse?: { status?: number; body?: unknown };
    }
  ).httpResponse;
  const status = Number(http?.status) || 500;
  const body = http?.body;
  let message = fallback;

  if (typeof body === "string" && body.trim()) {
    message = body;
    try {
      const parsed = JSON.parse(body) as {
        error?: { message?: string } | string;
        detail?: string;
      };
      const raw =
        typeof parsed.error === "string"
          ? parsed.error
          : parsed.error?.message || parsed.detail;
      if (raw) message = raw;
    } catch {
      // Keep the raw body text.
    }
  } else if (body && typeof body === "object") {
    const parsed = body as {
      error?: { message?: string } | string;
      detail?: string;
    };
    const raw =
      typeof parsed.error === "string"
        ? parsed.error
        : parsed.error?.message || parsed.detail;
    if (raw) message = raw;
  }

  return { status, message };
}

export async function hfImage(prompt: string) {
  const client = new InferenceClient(getHfToken());
  let lastError = "Зураг үүсгэж чадсангүй";
  let usedFallback = false;

  for (const provider of IMAGE_PROVIDERS) {
    if (isSkipped(provider)) {
      usedFallback = true;
      continue;
    }

    try {
      const image = await client.textToImage(
        {
          provider,
          model: IMAGE_MODEL,
          inputs: prompt,
          parameters: {
            num_inference_steps: 4,
            width: 1024,
            height: 1024,
          },
        },
        { outputType: "dataUrl" },
      );

      if (typeof image === "string" && image.startsWith("data:image/")) {
        return {
          image,
          model: "FLUX.1-schnell",
          fallback: usedFallback,
        };
      }

      lastError = "Модель хоосон зураг буцаалаа.";
    } catch (error) {
      const { status, message } = getErrorInfo(error);
      lastError = message;

      if (status === 401 || /invalid.*token|unauthorized/i.test(message)) {
        throw Object.assign(
          new Error(
            "Hugging Face token буруу байна. Шинэ token хуулаад .env.local-д хийж серверийг дахин асаана уу.",
          ),
          { status: 401 },
        );
      }

      if (
        isQuotaError(status, lastError) ||
        isDeprecated(status, lastError) ||
        isUnsupported(status, lastError)
      ) {
        exhaustedUntil.set(provider, Date.now() + EXHAUST_MS);
        usedFallback = true;
      }
    }
  }

  throw Object.assign(
    new Error(
      /rate|limit|quota|credit|exhausted|too many|daily|depleted/i.test(lastError)
        ? "Hugging Face-ийн энэ сарын үнэгүй кредит дууссан. huggingface.co/settings/billing дээр кредит авч болно, эсвэл сар солигдоход дахин оролдоно уу."
        : /404|deprecated|no longer supported|not supported/i.test(lastError)
          ? "Зураг үүсгэх модель түр ажиллахгүй байна. Дахин оролдоно уу."
          : lastError,
    ),
    { status: 502 },
  );
}
