---
'@mastra/core': minor
---

Harness v1: add `harness.models.*` catalog + auth-status surface.

Lets UIs render a model picker and surface per-model metadata (display name, context window, capability hints) without going through provider plumbing. The catalog is a static UX surface declared on `HarnessConfig.models`; auth status is resolved on demand via `HarnessConfig.modelAuthStatusResolver`.

- `harness.models.list()` — frozen snapshot of every catalog entry in declaration order.
- `harness.models.get(modelId)` — entry or `null`.
- `harness.models.getAuthStatus(modelId)` — `'authenticated' | 'needs_auth' | 'unknown'`. Throws `HarnessModelNotFoundError` for an id outside the catalog so typos surface immediately. Returns `'unknown'` for every id when no resolver is configured.
- New `ModelInfo` / `ModelAuthStatus` types.
- New `HarnessModelNotFoundError`.
- Construction-time validation rejects duplicate ids, missing/empty `id`, missing/empty `providerId`, and non-array `models`.

The catalog is not validated against modes — modes may reference models outside the catalog, and the catalog may include models not bound to any mode.
