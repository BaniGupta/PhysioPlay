// Talks to the FastAPI backend. Change the address in frontend/.env (VITE_API_URL) if needed.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const TOKEN_KEY = "physioplay.token";

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode: login lasts for this tab only */ }
}

/** `code` lets the screen show the message in the user's language (see i18n err.* keys). */
export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(`Can't reach the server at ${API_URL}.`, 0, "network");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const d = data?.detail;
    if (Array.isArray(d)) throw new ApiError(d.map((x) => x.msg).join(". "), res.status, "invalid");
    if (d && typeof d === "object") throw new ApiError(d.message, res.status, d.code);
    throw new ApiError(d || `Request failed (${res.status}).`, res.status, null);
  }
  return data;
}

export const api = {
  get: (p) => request("GET", p),
  post: (p, b) => request("POST", p, b ?? {}),
  put: (p, b) => request("PUT", p, b ?? {}),
};
