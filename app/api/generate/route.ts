import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    error: "Одоогийн Ollama модель зураг шинжилж, текстээр хариулна. Зураг үүсгэхэд тусдаа локал зураг үүсгэх модель шаардлагатай.",
  }, { status: 503 });
}
