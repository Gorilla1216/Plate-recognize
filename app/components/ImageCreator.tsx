"use client";

import { useState } from "react";
import { SparkleIcon } from "./icons";

export default function ImageCreator() {
  const [recipe, setRecipe] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  const canGenerate = recipe.trim().length > 0 && !isGenerating;

  async function onGenerate() {
    if (!recipe.trim()) return;

    setIsGenerating(true);
    setResultUrl(null);
    setError(null);
    setUsedModel(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe: recipe.trim() }),
      });

      const data = (await response.json()) as {
        image?: string;
        model?: string;
        fallback?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Зураг үүсгэж чадсангүй.");
      }

      if (!data.image) {
        throw new Error("Модель хоосон зураг буцаалаа.");
      }

      setResultUrl(data.image);
      setUsedModel(
        data.fallback && data.model
          ? `${data.model} (FLUX-ийн хязгаар дууссан тул энэ моделийг ашиглав)`
          : data.model ?? null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Зураг үүсгэж чадсангүй.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <SparkleIcon className="text-foreground" />
          <h2 className="text-[22px] font-semibold tracking-tight">
            Зураг үүсгэх
          </h2>
        </div>
        <p className="text-[15px] leading-6 text-muted">
          Хоолны жороо бичвэл зураг үүсгэнэ.
        </p>
      </header>

      <div className="flex w-full max-w-[520px] flex-col gap-3">
        <textarea
          value={recipe}
          onChange={(event) => {
            setRecipe(event.target.value);
            setResultUrl(null);
            setError(null);
            setUsedModel(null);
          }}
          placeholder="Хоолны жороо энд бичнэ үү..."
          className="min-h-[180px] w-full resize-y rounded-lg border border-border bg-background p-4 text-[14px] leading-6 outline-none placeholder:text-muted focus:border-foreground"
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate}
            className={`h-10 rounded-lg px-5 text-[14px] font-medium transition-colors ${
              canGenerate
                ? "bg-button text-button-foreground hover:bg-button-hover"
                : "cursor-not-allowed bg-disabled text-button-foreground"
            }`}
          >
            {isGenerating ? "Үүсгэж байна..." : "Үүсгэх"}
          </button>
        </div>
      </div>

      {error ? <p className="text-[13px] text-error">{error}</p> : null}

      <div className="w-full max-w-[520px]">
        {isGenerating ? (
          <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-accent bg-background p-4">
            <p className="text-center text-[14px] leading-6 text-muted">
              Жорын дагуу зураг үүсгэж байна, түр хүлээнэ үү.
            </p>
          </div>
        ) : resultUrl ? (
          <div className="overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultUrl}
              alt="Жороос үүсгэсэн хоолны зураг"
              className="aspect-square w-full object-cover"
            />
            {usedModel ? (
              <p className="border-t border-border px-4 py-2 text-[12px] text-muted">
                {usedModel}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
