/** Use the configured public origin, never request/proxy headers, for cookies. */
export function dashboardCookies(dashboardOrigin: string) {
  const origin = new URL(dashboardOrigin);
  // Safari versions reject Secure cookies on plain HTTP loopback origins.
  // Local cookies need separate names because __Host- requires Secure.
  const localHttp = origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  const prefix = localHttp ? 'authkit-local-' : '__Host-authkit-';
  return {
    session: `${prefix}session`,
    state: `${prefix}pkce`,
    issuedAt: `${prefix}issued-at`,
    options: {
      path: '/',
      httpOnly: true,
      secure: !localHttp,
      sameSite: 'Lax',
    } as const,
  };
}
