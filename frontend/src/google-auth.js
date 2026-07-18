// Google OAuth token + user info management.
// The access_token from @react-oauth/google is stored here and sent as
// a Bearer token on every API request.
// We also persist the decoded userinfo (email, name, picture) so the UI
// can display the user's name/avatar without re-fetching.

let _credential = null; // Google access_token
let _userInfo = null;   // { email, name, picture, sub } from Google userinfo
let _listeners = [];

export function setCredential(credential, userInfo = null) {
  _credential = credential;
  _userInfo = userInfo;
  _listeners.forEach((fn) => fn(credential, userInfo));
}

export function getCredential() { return _credential; }
export function getUserInfo() { return _userInfo; }

export function clearCredential() {
  _credential = null;
  _userInfo = null;
  sessionStorage.removeItem('g_credential');
  sessionStorage.removeItem('g_userinfo');
  _listeners.forEach((fn) => fn(null, null));
}

export function persistCredential(credential, userInfo = null) {
  sessionStorage.setItem('g_credential', credential);
  if (userInfo) sessionStorage.setItem('g_userinfo', JSON.stringify(userInfo));
  setCredential(credential, userInfo);
}

export function loadPersistedCredential() {
  const saved = sessionStorage.getItem('g_credential');
  if (!saved) return null;
  let userInfo = null;
  try {
    const raw = sessionStorage.getItem('g_userinfo');
    if (raw) userInfo = JSON.parse(raw);
  } catch { /* ignore corrupt cache */ }
  setCredential(saved, userInfo);
  return saved;
}

// Subscribe to auth state changes.
export function onAuthChange(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter((l) => l !== fn); }
}

// Safe token payload parser — returns null for non-JWT (opaque access tokens).
export function parseIdToken(credential) {
  if (!credential || !credential.includes('.')) return null;
  try {
    const parts = credential.split('.');
    if (parts.length < 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}
