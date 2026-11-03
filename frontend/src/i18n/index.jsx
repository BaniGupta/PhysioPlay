// Tiny translation system: English, Hindi, Punjabi.
// Use:  const { t, lang, setLang, fmtDate, errText } = useT();   t("home.hello", { name: "Riya" })
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en from "./en";
import hi from "./hi";
import pa from "./pa";

export const LANGS = [
  { code: "en", label: "English", short: "EN" },
  { code: "hi", label: "हिन्दी", short: "हिं" },
  { code: "pa", label: "ਪੰਜਾਬੀ", short: "ਪੰ" },
];
const DICTS = { en, hi, pa };
const LOCALE = { en: "en-IN", hi: "hi-IN", pa: "pa-IN" };
const KEY = "physioplay.lang";

// Some browsers have no Punjabi calendar data, so Punjabi month/day names are spelled out here.
const PA_MONTHS = ["ਜਨਵਰੀ", "ਫ਼ਰਵਰੀ", "ਮਾਰਚ", "ਅਪ੍ਰੈਲ", "ਮਈ", "ਜੂਨ", "ਜੁਲਾਈ", "ਅਗਸਤ", "ਸਤੰਬਰ", "ਅਕਤੂਬਰ", "ਨਵੰਬਰ", "ਦਸੰਬਰ"];
const PA_WEEKDAYS = ["ਐ", "ਸੋ", "ਮੰ", "ਬੁੱ", "ਵੀ", "ਸ਼ੁੱ", "ਸ਼"];
const toDate = (iso) => new Date(iso.length === 10 ? iso + "T00:00:00" : iso);

function initialLang() {
  try {
    const saved = localStorage.getItem(KEY);
    if (DICTS[saved]) return saved;
  } catch { /* storage blocked */ }
  const nav = (navigator.language || "").toLowerCase();
  if (nav.startsWith("hi")) return "hi";
  if (nav.startsWith("pa")) return "pa";
  return "en";
}

export function translate(lang, key, params) {
  let s = DICTS[lang]?.[key] ?? en[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined && params[k] !== null ? params[k] : m));
  return s;
}

const Ctx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l) => {
    if (!DICTS[l]) return;
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => {
    const t = (key, params) => translate(lang, key, params);
    const locale = LOCALE[lang];
    return {
      lang, setLang, t, locale,
      fmtDate: (iso, opts = { day: "numeric", month: "short" }) => {
        const d = toDate(iso);
        if (lang === "pa") return `${d.getDate()} ${PA_MONTHS[d.getMonth()]}`;
        return d.toLocaleDateString(locale, opts);
      },
      weekdayNarrow: (iso) => {
        const d = toDate(iso);
        return lang === "pa" ? PA_WEEKDAYS[d.getDay()] : d.toLocaleDateString(locale, { weekday: "narrow" });
      },
      /** Error from the API or the camera -> sentence in the current language. */
      errText: (err) => {
        const code = err?.code;
        if (code && (DICTS[lang][`err.${code}`] || en[`err.${code}`])) return t(`err.${code}`);
        return err?.message || String(err);
      },
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);
