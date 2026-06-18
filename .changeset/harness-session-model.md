---
'@mastra/core': patch
'mastracode': patch
---

Extract model selection state from Harness onto the Session class.

`SessionModel` (`session.model`) now owns the selected model id and per-mode
model persistence via a thread-settings store handle injected into `Session`:

- `get()` / `set({ modelId })` — in-memory selection
- `saveForMode({ modeId, modelId })` — persist per-mode model to thread settings
- `resolveForMode({ modeId, defaultModelId })` — load per-mode model from thread settings
- `hasSelection()` — whether a model is selected

`currentModelId` is removed from Harness state and the `getCurrentModelId()` /
`hasModelSelected()` public methods are gone — `session.model` is the single
source of truth. Dynamic resolvers read model/mode from the new
`HarnessRequestContext.session` object (`{ modeId, modelId }`). Mastracode
consumers and tests migrated to `harness.session.model.get()` /
`.hasSelection()` and the request-context `session` shape.
