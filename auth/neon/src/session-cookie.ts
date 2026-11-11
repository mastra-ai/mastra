/**
 * Neon Auth only accepts the signed session cookie for session-scoped calls
 * (get-session, organization lookups, sign-out). Bearer headers and raw
 * session tokens are ignored by the hosted service.
 *
 * The cookie that authenticated a user is kept here, keyed by the user object,
 * so `MastraRBACNeon` can look up organization roles for that same request
 * without the cookie being copied onto the user object (which ends up in the
 * request context and may be logged or serialized).
 */
const sessionCookies = new WeakMap<object, string>();

export function rememberSessionCookie(user: object, cookie: string): void {
  sessionCookies.set(user, cookie);
}

export function getRememberedSessionCookie(user: object): string | undefined {
  return sessionCookies.get(user);
}

/**
 * `GET /auth/me` passes the EEUser from `getCurrentUser()` to the RBAC
 * provider rather than the authenticated NeonAuthUser. Linking the two lets
 * RBAC resolve the same roles for both call sites.
 */
const linkedNeonUsers = new WeakMap<object, object>();

export function linkNeonUser(eeUser: object, neonUser: object): void {
  linkedNeonUsers.set(eeUser, neonUser);
}

export function getLinkedNeonUser(eeUser: object): object | undefined {
  return linkedNeonUsers.get(eeUser);
}

export function stripTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') {
    end--;
  }
  return url.slice(0, end);
}

/** Read a single cookie value from a Cookie header. */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(';')) {
    const index = pair.indexOf('=');
    if (index === -1) continue;
    if (pair.slice(0, index).trim() === name) {
      const value = pair.slice(index + 1).trim();
      return value || null;
    }
  }
  return null;
}
