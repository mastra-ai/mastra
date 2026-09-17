---
'@mastra/code-sdk': patch
'mastracode': patch
---

Rotate OAuth accounts automatically on eligible request failures. When the active account is rate-limited, quota-exhausted, or fails authentication after one forced token refresh, Mastra Code activates the next account in the pool and retries the request. Server errors and outages exhaust the transient retry budget first, then surface — or hop to a configured fallback pack. Every switch appears in the transcript as a one-line notice and is persisted in thread history.

Add accounts through the TUI — `/login` on an already-connected provider offers **Add another account**:

```text
/login
  → Add another account        # completes OAuth, returns to the manager
  → (submenu) Set as active    # optional; rotation happens on demand anyway
```

No configuration is needed beyond having two or more accounts for a provider; rotation follows account insertion order.
