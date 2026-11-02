import { NextResponse } from "next/server";
import { ollamaChat } from "@/app/lib/ollama";
import { errorResponse } from "@/app/lib/hf";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { messages?: unknown };
    if (!Array.isArray(body.messages)) {
      return NextResponse.json({ error: "Эхлээд мессеж бичнэ үү." }, { status: 400 });
    }
    const messages = body.messages.filter((item): item is { role: "user" | "assistant"; content: string } =>
      !!item && typeof item === "object" &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string" && !!item.content.trim(),
    );
    if (!messages.length) {
      return NextResponse.json({ error: "Эхлээд мессеж бичнэ үү." }, { status: 400 });
    }
    const reply = await ollamaChat({
      max_tokens: 800,
      messages: [
        { role: "system", content: "You are a helpful cooking assistant. Help with recipes, ingredients, substitutions, and cooking steps. Answer in clear, concise English." },
        ...messages.slice(-12),
      ],
    });
    return NextResponse.json({ reply });
  } catch (error) {
    return errorResponse(error);
  }
}
