import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useT } from "../i18n";
import { HeroPattern } from "../components/Pattern";
import { LangSwitch, Logo } from "../components/TopBar";

const DEMO = [
  { name: "Riya Sharma", pin: "1111", note: "demo.riya" },
  { name: "Aman Gill", pin: "2222", note: "demo.aman" },
  { name: "Harjeet Singh", pin: "3333", note: "demo.harjeet" },
];

export default function Login() {
  const { signIn } = useAuth();
  const { t, lang, errText } = useT();
  const nav = useNavigate();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(e, preset) {
    e?.preventDefault();
    setError("");
    setBusy(true);
    try {
      const register = !preset && mode === "register";
      const body = preset ? { name: preset.name, pin: preset.pin }
        : register ? { name, pin, language: lang } : { name, pin };
      await signIn(register ? "/auth/register" : "/auth/login", body);
      nav(register ? "/plans/new" : "/home");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <section className="login-art">
        <div className="spread">
          <div className="row" style={{ gap: 10 }}>
            <Logo size={36} />
            <span className="brand-word">{t("app.name")}</span>
          </div>
          <LangSwitch dark />
        </div>
        <h1>{t("login.headline")}</h1>
        <p>{t("login.sub")}</p>
        <div className="hero-wrap"><HeroPattern /></div>
      </section>

      <section className="login-form-wrap">
        <form className="login-form stack" style={{ "--gap": "18px" }} onSubmit={go}>
          <div className="seg" role="group">
            <button type="button" aria-pressed={mode === "login"} onClick={() => setMode("login")}>{t("login.tab.login")}</button>
            <button type="button" aria-pressed={mode === "register"} onClick={() => setMode("register")}>{t("login.tab.register")}</button>
          </div>

          <h2>{mode === "login" ? t("login.welcome") : t("login.start")}</h2>

          <div className="field">
            <label htmlFor="name">{t("login.name")}</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)}
              autoComplete="username" required minLength={2} />
          </div>
          <div className="field">
            <label htmlFor="pin">{t("login.pin")}</label>
            <input id="pin" className="input pin-input" value={pin} inputMode="numeric" pattern="\d{4}" maxLength={4}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} autoComplete="current-password" required />
          </div>

          {error && <div className="error" role="alert">{error}</div>}

          <button className="btn btn-marigold btn-block" disabled={busy}>
            {busy ? t("login.wait") : mode === "login" ? t("login.submit.login") : t("login.submit.register")}
          </button>

          {mode === "login" && (
            <div className="stack" style={{ "--gap": "10px", marginTop: 28 }}>
              <p className="faint">{t("login.demo")}</p>
              <div className="demo-people">
                {DEMO.map((d) => (
                  <button type="button" key={d.name} className="demo-person" disabled={busy} onClick={(e) => go(e, d)}>
                    <strong>{d.name}</strong><span>{t(d.note)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
