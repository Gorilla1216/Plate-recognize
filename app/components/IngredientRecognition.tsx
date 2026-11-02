"use client";

import { useEffect, useRef, useState } from "react";
import { ListIcon, ProduceIcon, UploadIcon } from "./icons";

const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
const ACCEPTED_EXT = ".jpg,.jpeg,.png";

function isAcceptedFile(file: File) {
  return ACCEPTED_TYPES.includes(file.type) || /\.(jpe?g|png)$/i.test(file.name);
}

export default function IngredientRecognition() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ingredients, setIngredients] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function applyFile(next: File) {
    if (!isAcceptedFile(next)) {
      setError(".JPG эсвэл .PNG зураг сонгоно уу.");
      return;
    }

    setError(null);
    setIngredients(null);
    setFile(next);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(next);
    });
  }

  function onDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const next = event.dataTransfer.files?.[0];
    if (next) applyFile(next);
  }

  async function onAnalyze() {
    if (!file && !note.trim()) {
      setError("Хоолны зураг оруулах эсвэл хоолоо тодорхойлно уу.");
      return;
    }

    setError(null);
    setIsAnalyzing(true);
    setIngredients(null);

    try {
      const formData = new FormData();
      if (note.trim()) formData.append("note", note.trim());
      if (file) formData.append("image", file);

      const response = await fetch("/api/ingredients", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        ingredients?: string[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "AI хүсэлт амжилтгүй боллоо.");
      }

      if (!data.ingredients?.length) {
        throw new Error("Орцыг таньж чадсангүй.");
      }

      setIngredients(data.ingredients);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI хүсэлт амжилтгүй боллоо.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ProduceIcon className="text-foreground" />
          <h2 className="text-[22px] font-semibold tracking-tight">
            Орц таних
          </h2>
        </div>
        <p className="text-[15px] leading-6 text-muted">
          Хоолоо сонгоод орцыг харна.
        </p>
      </header>

      <textarea
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
          setIngredients(null);
          setError(null);
        }}
        placeholder="Хоолоо тодорхойл эсвэл богино жор бичнэ үү..."
        className="min-h-[120px] w-full max-w-[520px] resize-y rounded-lg border border-border bg-background p-4 text-[14px] leading-6 outline-none placeholder:text-muted focus:border-foreground"
      />

      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`relative flex h-[180px] w-full max-w-[344px] cursor-pointer items-center justify-center rounded-lg border p-4 transition-colors ${
            isDragging
              ? "border-foreground bg-surface"
              : "border-border bg-background hover:border-border-hover"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXT}
            className="sr-only"
            onChange={(event) => {
              const next = event.target.files?.[0];
              if (next) applyFile(next);
            }}
          />

          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={file?.name ?? "Оруулсан хоолны зураг"}
              className="h-full w-full rounded-md object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <UploadIcon className="text-muted" />
              <p className="text-[14px] text-muted">Чирж оруулах эсвэл дарна уу</p>
            </div>
          )}
        </label>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={isAnalyzing}
          className="h-10 shrink-0 rounded-lg bg-button px-5 text-[14px] font-medium text-button-foreground transition-colors hover:bg-button-hover disabled:cursor-wait disabled:opacity-70"
        >
          {isAnalyzing ? "Шинжилж байна..." : "Шинжлэх"}
        </button>
      </div>

      {error ? <p className="text-[13px] text-error">{error}</p> : null}

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ListIcon className="text-foreground" />
          <h3 className="text-[16px] font-semibold">Танигдсан орц</h3>
        </div>

        <div className="min-h-[88px] rounded-lg border border-border p-4">
          {isAnalyzing ? (
            <p className="text-[14px] leading-6 text-muted">
              Шинжилж байна, түр хүлээнэ үү...
            </p>
          ) : ingredients ? (
            <ul className="list-disc space-y-1.5 pl-5 text-[14px] leading-6">
              {ingredients.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] leading-6 text-muted">
              Үр дүн энд гарна...
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
