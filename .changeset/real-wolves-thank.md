---
'mastracode': minor
---

Added pre/post hook wrapping for tool execution via `HookManager`, exported `createAuthStorage` for standalone auth provider initialization, and fixed Anthropic/OpenAI auth routing to use stored credential type as the source of truth.

**New API: `createAuthStorage`**

```ts
import { createAuthStorage } from 'mastracode';

const authStorage = createAuthStorage();
// authStorage is now wired into Claude Max and OpenAI Codex providers
```

- `disabledTools` config now also filters tools exposed to subagents, preventing bypass through delegation
- Auth routing uses `AuthStorage` credential type (`api_key` vs `oauth`) to correctly route API-key auth vs OAuth bearer auth
