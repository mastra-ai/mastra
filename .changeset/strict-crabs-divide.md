---
'@mastra/code-sdk': patch
'@mastra/factory': patch
'@mastra/server': patch
---

Factory observational memory now supports automatic model selection per role. `PUT /web/config/om/:role/model` accepts `modelId: 'auto'` to clear that role back to automatic selection, and any other value to pin it. Previously `'auto'` was stored as if it were a model name, which pinned the role to a model that does not exist; automatic roles are now stored as `null` and follow the active main model on every run. The request body is unchanged, so existing callers keep working.

Connecting a model provider no longer writes observer or reflector selections — it only reports whether the provider is reachable — and stored settings are applied per run instead of being copied into session state. Settings responses now report each role's intent, its effective model, and whether that model's provider is currently available. If Factory cannot load the authoritative row, it keeps storage-backed memory available but suppresses model-driven memory work instead of using stale session selections.

The server now prevents request payloads from overriding Factory's internal memory-settings context.
