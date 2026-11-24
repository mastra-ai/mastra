---
'@mastra/factory': minor
'mastra': patch
---

Factory runs now continue on fallback models. A project or a person can list up to 3 fallback models after their default model: `fallbackModelIds` on `PATCH /web/factory/projects/:id`, and `PUT /web/config/default-model/fallbacks` for personal settings. When the default model is rate-limited, out of credits, unauthorized or unavailable, the run continues on the next fallback that has a key. The next run starts on the default model again. `GET /web/config/models` returns the fallbacks that apply to the session.

Default and fallback model IDs must now use the `provider/model` form, for example `anthropic/claude-opus-5.5`. The settings API rejects any other value with a 400.
