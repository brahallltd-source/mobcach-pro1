
"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { LANGS, Lang, defaultLang, translate, TranslationKey } from "@/lib/i18n";

type LanguageContextValue = {
  lang: Lang;
  setLang: (next: Lang) => void;
  t: (key: TranslationKey) => string;
  dir: "ltr" | "rtl";
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(defaultLang);

  useEffect(() => {
    const stored = localStorage.getItem("mobcash_lang") as Lang | null;
    const next = stored && LANGS.some((item) => item.value === stored) ? stored : defaultLang;
    setLangState(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";

    const onStorage = () => {
      const fresh = localStorage.getItem("mobcash_lang") as Lang | null;
      if (!fresh) return;
      setLangState(fresh);
      document.documentElement.lang = fresh;
      document.documentElement.dir = fresh === "ar" ? "rtl" : "ltr";
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLang = (next: Lang) => {
    localStorage.setItem("mobcash_lang", next);
    setLangState(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
  };

  const value = useMemo(() => ({
    lang,
    setLang,
    t: (key: TranslationKey) => translate(lang, key),
    dir: lang === "ar" ? "rtl" : "ltr",
  }), [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      lang: defaultLang,
      setLang: () => {},
      t: (key: TranslationKey) => translate(defaultLang, key),
      dir: defaultLang === "ar" ? "rtl" : "ltr",
    };
  }
  return ctx;
}

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/55">
      {LANGS.map((item) => (
        <button
          key={item.value}
          onClick={() => setLang(item.value)}
          className={`rounded-xl px-3 py-2 transition ${lang === item.value ? "bg-white text-slate-950" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
