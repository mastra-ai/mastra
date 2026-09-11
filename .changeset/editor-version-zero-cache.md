---
'@mastra/editor': patch
---

Fix editor namespaces returning a cached default entity for `getById(id, { versionNumber: 0 })`. Version-request detection used a truthiness check, so `versionNumber: 0` was treated as a default request and served from the cache on a warm cache while returning `null` on a cold cache. Detection now uses explicit `!== undefined` checks in the shared `CrudEditorNamespace` and the agent adapter, so a `versionNumber` (including `0`) consistently bypasses the cache and reaches version resolution. Fixes #23396.
