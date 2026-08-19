---
'@internal/playground': patch
---

fix(playground): retry /api/auth/me on transient 503 from auth middleware

The Mastra server middleware distinguishes transient auth-provider failures
(503) from terminal auth failures (401). Playground's `useCurrentUser` had
`retry: false`, so a single 503 flipped the query to `isError` and triggered
the login flow — which amplified WorkOS 429 lockouts (PLTFRM-1270).

Now retries on 503 up to 3 times with exponential backoff (500ms → 8s cap).
401 (terminal) still fails fast. Mirrors the parity fix on the platform
dashboard's `useAuth` hook.
