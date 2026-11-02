import { NextResponse } from "next/server";
import { errorResponse } from "@/app/lib/hf";
import { ollamaChat } from "@/app/lib/ollama";

export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png"]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const note = String(formData.get("note") ?? "").trim();
    const file = formData.get("image");
    let dataUrl: string | undefined;
    if (file instanceof File) {
      if (!ACCEPTED_TYPES.has(file.type)) {
        return NextResponse.json({ error: ".JPG эсвэл .PNG зураг оруулна уу." }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "Зураг хэт том байна. 4MB-аас бага файл ашиглана уу." }, { status: 400 });
      }
      dataUrl = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
    }
    if (!note && !dataUrl) {
      return NextResponse.json({ error: "Хоолны зураг оруулах эсвэл хоолоо тодорхойлно уу." }, { status: 400 });
    }
    const prompt = `List food ingredients in English.
${dataUrl ? "Use only ingredients visibly identifiable in the attached photo; do not guess hidden ingredients." : "For the dish described below, give its usual ingredients."}
Return only JSON: {"ingredients":["..."]}. Keep the list short; omit uncertain items.
Dish description: ${note || "See attached photo."}`;
    const raw = await ollamaChat({
      max_tokens: 800,
      json: true,
      messages: [{ role: "user", content: dataUrl
        ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }]
        : prompt }],
    });
    let parsed: { ingredients?: unknown };
    try { parsed = JSON.parse(raw); }
    catch { throw Object.assign(new Error("Орцыг таньж чадсангүй. Дахин оролдоно уу."), { status: 502 }); }
    const ingredients = Array.isArray(parsed?.ingredients)
      ? parsed.ingredients.filter((item): item is string => typeof item === "string" && !!item.trim()).map((item) => item.trim())
      : [];
    if (!ingredients.length) {
      return NextResponse.json({ error: "Орцыг таньж чадсангүй. Илүү тодорхой тайлбар бичнэ үү." }, { status: 502 });
    }
    return NextResponse.json({ ingredients });
  } catch (error) { return errorResponse(error); }
}
