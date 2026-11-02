"use client";

import { useEffect, useRef, useState } from "react";
import { ChatIcon } from "./icons";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatFab() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Сайн уу! Жор, орц, хоол хийх талаар асууж болно.",
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open, isSending]);

  async function onSend() {
    const text = input.trim();
    if (!text || isSending) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.filter((item) => item.content.trim()),
        }),
      });

      const data = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Чат хүсэлт амжилтгүй боллоо.");
      }
      if (!data.reply) {
        throw new Error("Gemini хоосон хариу өглөө.");
      }

      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.reply as string },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Чат хүсэлт амжилтгүй боллоо.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed right-6 bottom-6 z-20 flex flex-col items-end gap-3">
      {open ? (
        <div className="flex h-[460px] w-[340px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[var(--shadow)]">
          <div className="border-b border-border px-4 py-3">
            <p className="text-[14px] font-semibold">Чат туслах</p>
            <p className="text-[12px] text-muted">Gemini 3 Flash</p>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((item, index) => (
              <div
                key={`${item.role}-${index}`}
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px] leading-5 ${
                  item.role === "user"
                    ? "ml-auto bg-button text-button-foreground"
                    : "bg-surface text-foreground"
                }`}
              >
                {item.content}
              </div>
            ))}
            {isSending ? (
              <p className="text-[12px] text-muted">Бодож байна...</p>
            ) : null}
          </div>

          <div className="border-t border-border p-3">
            {error ? (
              <p className="mb-2 text-[12px] leading-4 text-error">{error}</p>
            ) : null}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void onSend();
                  }
                }}
                placeholder="Жор, орцын талаар асууна уу..."
                rows={2}
                className="min-h-[44px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none placeholder:text-muted focus:border-foreground"
              />
              <button
                type="button"
                onClick={() => void onSend()}
                disabled={isSending || !input.trim()}
                className="h-10 rounded-lg bg-button px-3 text-[13px] font-medium text-button-foreground transition-colors hover:bg-button-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Илгээх
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Чат туслах"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-button text-button-foreground shadow-[var(--shadow)] transition-colors hover:bg-button-hover"
      >
        <ChatIcon />
      </button>
    </div>
  );
}
