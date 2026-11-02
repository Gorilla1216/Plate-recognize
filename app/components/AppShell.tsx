"use client";

import { useState } from "react";
import ImageAnalysis from "./ImageAnalysis";
import IngredientRecognition from "./IngredientRecognition";
import ImageCreator from "./ImageCreator";
import ChatFab from "./ChatFab";
import ThemeToggle from "./ThemeToggle";

const TABS = [
  { id: "analysis", label: "Зураг шинжлэх" },
  { id: "ingredients", label: "Орц таних" },
  { id: "creator", label: "Зураг үүсгэх" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AppShell() {
  const [tab, setTab] = useState<TabId>("analysis");

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto flex w-full max-w-[720px] flex-col px-6 py-12 sm:px-10 sm:py-16">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[28px] font-semibold tracking-tight">AI хэрэгсэл</h1>
          <ThemeToggle />
        </div>

        <nav className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-border">
          {TABS.map((item) => {
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`-mb-px border-b-2 pb-3 text-[14px] transition-colors ${
                  active
                    ? "border-foreground font-semibold text-foreground"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <main className="pt-10">
          {tab === "analysis" ? (
            <ImageAnalysis />
          ) : tab === "ingredients" ? (
            <IngredientRecognition />
          ) : (
            <ImageCreator />
          )}
        </main>
      </div>
      <ChatFab />
    </div>
  );
}
