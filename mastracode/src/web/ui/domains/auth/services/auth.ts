/**
 * Client-side glue for the optional WorkOS AuthKit gate (see ../auth.ts).
 *
 * The server protects the whole surface; this module makes the SPA cooperate:
 * - `fetchAuthState()` reads `/auth/me` to decide whether to show the splash
 *   (unauthenticated) or the app, and to render identity / sign-out. Degrades
 *   gracefully to "auth disabled" when the route is absent.
 * - `loginUrl()` / `redirectToLogin()` build/navigate to the hosted WorkOS
 *   login URL (used by the /signin page).
 * - `redirectToLogout()` / `logoutUrl()` send the user through the server logout route.
 *
 * Every helper takes the API base URL injected by `ApiConfigProvider` (empty
 * string when the app is served same-origin) so the frontend dev server on a
 * different port still reaches the Mastra server — same pattern as the shared
 * API client and `use-fs`.
 */

export interface WebAuthState {
  /** Whether the server has WorkOS auth configured. */
  authEnabled: boolean;
  authenticated: boolean;
  user?: { email?: string; name?: string };
}

/**
 * Build the hosted-login URL. `returnTo` is where the server sends the user
 * after authenticating; it defaults to the current location so contexts that
 * are not `/signin` (which would loop back to itself) round-trip in place.
 */
export function loginUrl(
  baseUrl: string,
  returnTo: string = window.location.pathname + window.location.search,
): string {
  return `${baseUrl}/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

/** Full-page navigation to the hosted login (see `loginUrl` for `returnTo`). */
export function redirectToLogin(baseUrl: string, returnTo?: string): void {
  window.location.assign(loginUrl(baseUrl, returnTo));
}

export function logoutUrl(baseUrl: string): string {
  return `${baseUrl}/auth/logout`;
}

export function redirectToLogout(baseUrl: string): void {
  window.location.assign(logoutUrl(baseUrl));
}

/**
 * Fetch the current auth state from `/auth/me`. When the route is missing (auth
 * disabled), reports `authEnabled: false` so the UI hides all auth affordances.
 */
export async function fetchAuthState(baseUrl: string): Promise<WebAuthState> {
  try {
    const res = await fetch(`${baseUrl}/auth/me`, { headers: { Accept: 'application/json' } });
    if (res.status === 404) {
      return { authEnabled: false, authenticated: false };
    }
    if (!res.ok) {
      return { authEnabled: true, authenticated: false };
    }
    const data = (await res.json()) as { authenticated?: boolean; user?: { email?: string; name?: string } | null };
    return {
      authEnabled: true,
      authenticated: Boolean(data.authenticated),
      user: data.user ?? undefined,
    };
  } catch {
    // Network error or non-JSON response → treat as auth not configured so the
    // app stays usable rather than blocking on a missing endpoint.
    return { authEnabled: false, authenticated: false };
  }
}
