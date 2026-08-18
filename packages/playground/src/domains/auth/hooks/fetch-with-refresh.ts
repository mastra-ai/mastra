/**
 * Fetch wrapper for the Mastra server API.
 *
 * ⚠️  MIRRORS: `platform/frontend/src/shared/lib/fetch-with-refresh.ts`
 *
 * Both files must stay behaviourally in lockstep — the platform dashboard and
 * the embedded playground both talk to WorkOS-backed auth and both would be
 * vulnerable to the same 429 lockout loop if either regressed. If you change
 * one, change the other in the same PR (or extract to a shared package —
 * currently blocked by the platform/mastra-ai monorepo boundary).
 *
 * ---
 *
 * The server middleware already refreshes the WorkOS session transparently
 * on every protected request. There is no scenario where the client can
 * succeed by calling /auth/refresh after a 401 — that endpoint hits the
 * same broken WorkOS with the same session and would only amplify transient
 * failures into forced logout (PLTFRM-1270).
 *
 * These are pass-throughs today. The names and signatures are preserved for
 * compatibility with existing call sites (`App.tsx`, `use-current-user.ts`).
 * Transient-failure retry belongs one level up — in React Query's `retry`
 * config on individual queries — not in a fetch wrapper that would compound
 * with the query-level retry.
 */

export async function fetchWithRefresh(
  _baseUrl: string,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, init);
}

export function createFetchWithRefresh(_baseUrl?: string, _apiPrefix?: string): typeof fetch {
  return (input, init) => fetch(input, init);
}
