/**
 * Client-side glue for the optional WorkOS AuthKit gate (see ../auth.ts).
 *
 * The server protects the whole surface; this module makes the SPA cooperate:
 * - `fetchAuthState()` reads `/auth/me` to decide whether to show the splash
 *   (unauthenticated) or the app, and to render identity / sign-out. Degrades
 *   gracefully to "auth disabled" when the route is absent.
 * - `redirectToLogin()` / `loginUrl()` send the user to the hosted WorkOS login
 *   from the splash "Sign in" button.
 */

export interface WebAuthState {
  /** Whether the server has WorkOS auth configured. */
  authEnabled: boolean;
  authenticated: boolean;
  user?: { email?: string; name?: string };
}

/**
 * Build the hosted-login URL, preserving the current location so the user is
 * returned here after authenticating. Used by the splash "Sign in" button.
 */
export function loginUrl(): string {
  const returnTo = window.location.pathname + window.location.search;
  return `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

/**
 * Redirect the browser to the hosted login. Called from the splash screen when
 * the user clicks "Sign in".
 */
export function redirectToLogin(): void {
  window.location.assign(loginUrl());
}

/**
 * Fetch the current auth state from `/auth/me`. When the route is missing (auth
 * disabled), reports `authEnabled: false` so the UI hides all auth affordances.
 */
export async function fetchAuthState(): Promise<WebAuthState> {
  try {
    const res = await fetch('/auth/me', { headers: { Accept: 'application/json' } });
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
