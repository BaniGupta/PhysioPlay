import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { LANGS, useT } from "../i18n";
import { PatternBand } from "./Pattern";

export function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#1F2350" />
      <path d="M32 10 54 32 32 54 10 32Z" fill="#F4A40C" />
      <path d="M32 20 44 32 32 44 20 32Z" fill="#D4246E" />
      <path d="M32 27 37 32 32 37 27 32Z" fill="#FFF7E6" />
    </svg>
  );
}

export function LangSwitch({ dark = false }) {
  const { lang, setLang, t } = useT();
  return (
    <div className={`lang-switch ${dark ? "dark" : ""}`} role="group" aria-label={t("lang.label")}>
      {LANGS.map((l) => (
        <button key={l.code} type="button" aria-pressed={lang === l.code} title={l.label} lang={l.code}
          onClick={() => setLang(l.code)}>
          {l.short}
        </button>
      ))}
    </div>
  );
}

export default function TopBar() {
  const { user, signOut } = useAuth();
  const { t } = useT();
  const nav = useNavigate();
  const links = [["/home", t("nav.today")], ["/progress", t("nav.progress")]];
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <NavLink to="/" className="brand"><Logo /> <span>{t("app.name")}</span></NavLink>
        <nav className="nav" aria-label="Main">
          {links.map(([to, label]) => <NavLink key={to} to={to} end>{label}</NavLink>)}
          <button onClick={() => { signOut(); nav("/login"); }}>{t("nav.logout")}</button>
        </nav>
        <LangSwitch />
      </div>
      <PatternBand count={70} height={8} />
    </header>
  );
}
