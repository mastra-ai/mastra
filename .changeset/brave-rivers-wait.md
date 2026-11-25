---
'@mastra/factory': minor
---

Factory sessions and runs now use model packs. A pack is a named list of up to 4 models, each with its own thinking level. The first model runs the session; when it is rate-limited, out of credits, unauthorized or unavailable, the run continues on the next model in the pack that has a key.

A Factory and each person can keep up to 8 packs, and one of them is the default. A session runs either a pack or an exact model. On a pack, every request runs the pack's current models in order, so edits to the pack apply on the next request; sessions on the default follow whichever pack is the default. An exact model runs alone at its own thinking level, with no fallbacks. Existing default models show up as a pack called "Default".

API changes:

- `POST /web/factory/projects` accepts `defaultModelId`, so any member can pick the model when creating a Factory. The new Factory gets a "Default" pack on that model.
- `PATCH /web/factory/projects/:id` accepts `modelPacks` and `defaultModelPackId`, sent together. After creation, only organization admins can change the packs or `defaultModelId`. `defaultModelId` replaces the first model of the default pack and no longer accepts `null`.
- `GET /web/config/default-model` returns `modelPacks` and `defaultModelPackId` next to `modelId` and `thinkingLevel`.
- `PUT /web/config/model-packs` replaces your personal packs.
- `PUT /web/config/session-model` runs a session you own on the default pack, one of your packs, or an exact model, for example `{ "resourceId": "…", "threadId": "…", "selection": { "kind": "pack", "packId": "review" } }` or `{ …, "selection": { "kind": "model", "modelId": "openai/gpt-5.6-sol", "thinkingLevel": "high" } }`. It returns the session's `modelSelection`. Teammates get a 403.
- `GET /web/config/models` for a session returns `modelPacks`, `defaultModelPackId` and the session's `modelSelection`: `{ "kind": "pack", "packId": "…" }` or `{ "kind": "model" }`.
- `POST /web/factory/projects/:id/apply-default-model`, `POST /web/config/default-model/apply` and `DELETE /web/config/default-model` are removed. Sessions follow pack edits on their own; to change your default, edit your packs with `PUT /web/config/model-packs`.
- `PUT /web/config/default-model/thinking` and the `defaultThinkingLevel` field of `PATCH /web/factory/projects/:id` are removed. Each model in a pack carries its own thinking level.

Model IDs must use the `provider/model` form. The settings API rejects any other value with a 400, so add the provider to a bare ID before sending it:

```diff
- { "defaultModelId": "claude-opus-5.5" }
+ { "defaultModelId": "anthropic/claude-opus-5.5" }
```
