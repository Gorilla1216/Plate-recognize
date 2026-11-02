import { NextResponse } from "next/server";
import { errorResponse } from "@/app/lib/hf";
import { ollamaChat } from "@/app/lib/ollama";

export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png"]);

const PROMPT = `Describe the food in this photo. Answer in plain English.
List only ingredients that are visibly identifiable. Do not guess hidden ingredients or allergens.
If something cannot be identified, say it is uncertain. Keep the answer short.
Use this format:
Ingredients:
- ...
- ...

Summary:
...`;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Зураг оруулаагүй байна." }, { status: 400 });
    }

    if (!ACCEPTED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: ".JPG эсвэл .PNG зураг оруулна уу." },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Зураг хэт том байна. 4MB-аас бага файл ашиглана уу." },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${bytes.toString("base64")}`;

    const summary = await ollamaChat({
      max_tokens: 1600,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    return NextResponse.json({ summary });
  } catch (error) {
    return errorResponse(error);
  }
}
