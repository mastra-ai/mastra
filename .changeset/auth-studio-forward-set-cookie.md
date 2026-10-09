---
'@mastra/auth-studio': patch
'@mastra/server': patch
'@mastra/core': patch
'@mastra/factory': patch
---

Keep Studio and Factory sessions alive for the identity provider's full session length.

- `MastraAuthStudio` session cookies now last 14 days by default (was a hardcoded 24 hours), configurable via the new `sessionMaxAgeSeconds` option or the `MASTRA_SESSION_MAX_AGE` environment variable.
- When the shared API renews the session during verification, `MastraAuthStudio` re-issues the renewed cookie under the deployment's own cookie domain and exposes it through a new optional `consumePendingResponseHeaders` provider hook.
- `@mastra/server`'s auth middleware, `CompositeAuth`, the Factory auth gate, and Factory's per-route `ensureFactoryAuthUser` (used by routes declared `requiresAuth: false`, which skip the gate) forward those headers to the browser, as does the public `GET /auth/me` route. Forwarding is best-effort and never fails a request.

```ts
import { MastraAuthStudio } from '@mastra/auth-studio';

// Defaults to 14 days. Override per deployment, or set MASTRA_SESSION_MAX_AGE (seconds).
const auth = new MastraAuthStudio({ sessionMaxAgeSeconds: 7 * 24 * 60 * 60 });
```
