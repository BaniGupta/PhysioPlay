import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api/client";
import { useT } from "./i18n";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const { lang } = useT();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api.get("/auth/me")
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  // The language picked on this device is saved to the account too.
  useEffect(() => {
    if (user && user.language !== lang) {
      api.put("/auth/me", { language: lang }).then(setUser).catch(() => {});
    }
  }, [user, lang]);

  const signIn = useCallback(async (path, body) => {
    const res = await api.post(path, body);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const signOut = useCallback(() => { setToken(null); setUser(null); }, []);

  return (
    <AuthCtx.Provider value={{ user, setUser, ready, signIn, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
