---
'@mastra/factory': minor
'mastra': patch
---

Factory sessions and runs now use model packs. A pack is a named list of up to 4 models, each with its own thinking level. The first model runs the session; when it is rate-limited, out of credits, unauthorized or unavailable, the run continues on the next model in the pack that has a key.

A Factory and each person can keep up to 8 packs, and one of them is the default. New runs start on the default pack, and the next run starts on its first model again. A session can switch to another pack and keeps it until it switches again. Existing default models show up as a pack called "Default".

API changes:

- `PATCH /web/factory/projects/:id` accepts `modelPacks` and `defaultModelPackId`, sent together. Only organization admins can change them.
- `GET /web/config/default-model` returns `modelPacks` and `defaultModelPackId` next to `modelId` and `thinkingLevel`.
- `PUT /web/config/model-packs` replaces your personal packs.
- `PUT /web/config/session-model-pack` switches a running session to one of its owner's packs, for example `{ "resourceId": "…", "threadId": "…", "modelPackId": "review" }`.
- `GET /web/config/models` for a session returns `modelPacks`, `defaultModelPackId` and the session's `modelPackId`.

Model IDs must use the `provider/model` form, for example `anthropic/claude-opus-5.5` or `openai/gpt-5.6-sol`. The settings API rejects any other value with a 400.
