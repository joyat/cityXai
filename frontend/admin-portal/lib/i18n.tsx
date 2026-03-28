"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "de" | "en";

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
};

const STORAGE_KEY = "cityxai_language";
const COOKIE_KEY = "cityxai_language";

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("de");

  useEffect(() => {
    const fromCookie = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${COOKIE_KEY}=`))
      ?.split("=")[1];
    const fromStorage = window.localStorage.getItem(STORAGE_KEY);
    const next = fromCookie === "en" || fromStorage === "en" ? "en" : "de";
    setLanguageState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.cookie = `${COOKIE_KEY}=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage: (next: Language) => setLanguageState(next),
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

export function LanguageSelector() {
  const { language, setLanguage } = useI18n();

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button
        type="button"
        className={language === "de" ? "" : "secondary"}
        onClick={() => setLanguage("de")}
        style={{ padding: "6px 10px", fontSize: "0.76rem", minWidth: 72, justifyContent: "center" }}
      >
        Deutsch
      </button>
      <button
        type="button"
        className={language === "en" ? "" : "secondary"}
        onClick={() => setLanguage("en")}
        style={{ padding: "6px 10px", fontSize: "0.76rem", minWidth: 72, justifyContent: "center" }}
      >
        English
      </button>
    </div>
  );
}
