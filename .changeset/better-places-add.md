---
'@mastra/factory': patch
---

Factory now names the identity provider it falls back to. With no `auth` passed, it installs the platform-backed provider and signs users in against Mastra's hosted platform — previously without saying so anywhere, which made a local dev server look self-contained while it was talking to production.

```
[factory] Identity defers to https://platform.mastra.ai/v1 (default). Pass `auth` for your own provider, `auth: null` to disable auth, or MASTRA_SHARED_API_URL to point elsewhere.
```

Behavior is unchanged — the default still works exactly as before, it is just no longer invisible.
