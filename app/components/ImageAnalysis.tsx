"use client";

import { useEffect, useRef, useState } from "react";
import { DocumentIcon, ScanIcon, UploadIcon } from "./icons";

const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
const ACCEPTED_EXT = ".jpg,.jpeg,.png";

function isAcceptedFile(file: File) {
  return ACCEPTED_TYPES.includes(file.type) || /\.(jpe?g|png)$/i.test(file.name);
}

export default function ImageAnalysis() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
        entry.type.startsWith("image/"),
      );
      const pasted = item?.getAsFile();
      if (pasted) applyFile(pasted);
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function applyFile(next: File) {
    if (!isAcceptedFile(next)) {
      setError(".JPG эсвэл .PNG зураг сонгоно уу.");
      return;
    }

    setError(null);
    setSummary(null);
    setFile(next);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(next);
    });
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    if (next) applyFile(next);
  }

  function onDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const next = event.dataTransfer.files?.[0];
    if (next) applyFile(next);
  }

  async function onGenerate() {
    if (!file) {
      setError("Эхлээд зургаа оруулаад орцыг танина уу.");
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        summary?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "AI хүсэлт амжилтгүй боллоо.");
      }

      if (!data.summary) {
        throw new Error("Модель хоосон хариу өглөө.");
      }

      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI хүсэлт амжилтгүй боллоо.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ScanIcon className="text-foreground" />
          <h2 className="text-[22px] font-semibold tracking-tight">
            Зураг шинжлэх
          </h2>
        </div>
        <p className="text-[15px] leading-6 text-muted">
          Хоолны зураг оруулбал орцыг танина.
        </p>
      </header>

      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`relative flex h-[180px] w-full max-w-[384px] cursor-pointer flex-col justify-center rounded-lg border p-4 transition-colors ${
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
            onChange={onInputChange}
          />

          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={file?.name ?? "Оруулсан хоолны зураг"}
              className="h-full w-full rounded-md object-cover"
            />
          ) : (
            <div className="flex flex-col items-start gap-3 text-left">
              <span className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] font-medium">
                <UploadIcon className="text-foreground" />
                Файл сонгох
              </span>
              <p className="text-[13px] text-muted">
                Файл: .JPG, .PNG
              </p>
              <p className="text-[12px] text-muted">
                Чирж оруулах, эсвэл зураг хуулж тавина.
              </p>
            </div>
          )}
        </label>

        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className="h-10 shrink-0 rounded-lg bg-button px-5 text-[14px] font-medium text-button-foreground transition-colors hover:bg-button-hover disabled:cursor-wait disabled:opacity-70"
        >
          {isGenerating ? "Үүсгэж байна..." : "Үүсгэх"}
        </button>
      </div>

      {error ? <p className="text-[13px] text-error">{error}</p> : null}

      {file ? (
        <p className="text-[13px] text-muted">
          Файл: {file.name}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <DocumentIcon className="text-foreground" />
          <h3 className="text-[16px] font-semibold">Товч тайлбар</h3>
        </div>

        <div className="min-h-[88px] rounded-lg border border-border p-4">
          <p className="whitespace-pre-wrap text-[14px] leading-6 text-muted">
            {summary ??
              "Эхлээд зургаа оруулаад орцыг танина уу."}
          </p>
        </div>
      </div>
    </section>
  );
}
