export function setAuthCookie(token: string) {
  // Sets an Http-accessible Secure/SameSite cookie in the browser
  const maxAge = 60 * 60 * 24; // 24 hours
  document.cookie = `token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function getAuthCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )token=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export function clearAuthCookie() {
  document.cookie = `token=; path=/; max-age=0; SameSite=Lax`;
}

export function getAuthHeaders(): HeadersInit {
  const token = getAuthCookie();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

