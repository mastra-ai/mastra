/**
 * Client-side glue for the optional web auth gate (see src/web/auth.ts).
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

export interface FactoryAuthState {
  /** Whether the server has web auth configured (any provider). */
  authEnabled: boolean;
  authenticated: boolean;
  user?: { userId?: string; email?: string; name?: string };
  /** Active identity provider: 'workos' | 'better-auth' | custom adapter kind. */
  provider?: string;
  /** True when the provider hosts credential forms and sign-up is disabled. */
  signUpDisabled?: boolean;
}

/** The resourceId under which a user's personal (non-factory) sessions live. */
export function userSessionResourceId(state: FactoryAuthState | undefined): string {
  const userId = state?.user?.userId;
  if (!userId) throw new Error('Authenticated user is missing a user id');
  return userId;
}

export function userMessageAttributes(
  state: FactoryAuthState | undefined,
): { name: string; userId?: string } | undefined {
  const name = state?.authenticated ? state.user?.name : undefined;
  if (!name || name.length > 128) return undefined;
  const userId = state?.user?.userId;
  return userId && userId.length <= 128 ? { name, userId } : { name };
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

export function clearMastraCodeStorage(): void {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith('mastracode')) localStorage.removeItem(key);
  }
}

export function redirectToLogout(baseUrl: string): void {
  window.location.assign(logoutUrl(baseUrl));
}

/**
 * POST credentials to a better-auth endpoint (`basePath: /auth/api`). The
 * session cookie is set by the response; the caller navigates afterwards.
 * Throws with the server's message so the sign-in form can display it.
 */
async function postBetterAuthCredentials(baseUrl: string, path: string, body: Record<string, string>): Promise<void> {
  const res = await fetch(`${baseUrl}/auth/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = 'Authentication failed';
    try {
      const data = (await res.json()) as { message?: string };
      if (data?.message) message = data.message;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new Error(message);
  }
}

/**
 * Full-page navigation after a successful credential sign-in, so the app boots
 * with the fresh session cookie. Service-level (like `redirectToLogin`) because
 * jsdom's `window.location.assign` is unforgeable in tests.
 */
export function navigateAfterSignIn(returnTo: string): void {
  window.location.assign(returnTo);
}

/** Email/password sign-in against the self-hosted better-auth provider. */
export function signInWithPassword(baseUrl: string, input: { email: string; password: string }): Promise<void> {
  return postBetterAuthCredentials(baseUrl, 'sign-in/email', input);
}

/** Email/password sign-up against the self-hosted better-auth provider. */
export function signUpWithPassword(
  baseUrl: string,
  input: { name: string; email: string; password: string },
): Promise<void> {
  return postBetterAuthCredentials(baseUrl, 'sign-up/email', input);
}

/**
 * Fetch the current auth state from `/auth/me`. When the route is missing (auth
 * disabled), reports `authEnabled: false` so the UI hides all auth affordances.
 */
export async function fetchAuthState(baseUrl: string): Promise<FactoryAuthState> {
  const res = await fetch(`${baseUrl}/auth/me`, { headers: { Accept: 'application/json' }, credentials: 'include' });
  if (res.status === 404) {
    return { authEnabled: false, authenticated: false };
  }
  if (res.status === 401 || res.status === 403) {
    return { authEnabled: true, authenticated: false };
  }
  if (!res.ok) {
    throw new Error(`Auth check failed (${res.status})`);
  }
  const data = (await res.json()) as {
    authenticated?: boolean;
    user?: { userId?: string; email?: string; name?: string } | null;
    provider?: string;
    signUpDisabled?: boolean;
  };
  return {
    authEnabled: true,
    authenticated: Boolean(data.authenticated),
    user: data.user ?? undefined,
    provider: data.provider,
    signUpDisabled: data.signUpDisabled,
  };
}
