---
'mastracode': patch
---

When a model provider is down or unreachable, the TUI now shows "Model provider unavailable" with the HTTP status and request URL instead of a bare "Not Found", plus a hint to check the provider's status page or switch providers with `/model`.
