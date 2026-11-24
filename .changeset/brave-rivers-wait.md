---
'@mastra/factory': minor
'mastra': patch
---

Factory runs now continue on fallback models. A project or a person can list up to 3 fallback models after their default model: `fallbackModelIds` on `PATCH /web/factory/projects/:id`, and `PUT /web/config/default-model/fallbacks` for personal settings. When the default model is rate-limited, out of credits, unauthorized or unavailable, the run continues on the next fallback that has a key. When the provider sends a retry time, later runs start on that fallback until then and try the default model last. Otherwise the next run starts on the default model again. `GET /web/config/models` returns the fallbacks that apply to the session.

When every model is limited, Factory handles the run by cause:

- **Rate limit:** Factory retries after the provider's retry time for up to an hour, with a last retry at the end of that hour. Waiting does not use up the run's attempts. A run that got work done before it hit the limit again starts a new hour but uses an attempt, so it stops after 5.
- **Out of credits or quota:** the run stops with `run_quota_exhausted` until a person retries it.

A retried skill run resumes the work already done instead of sending the skill again.

Default and fallback model IDs must now use the `provider/model` form, for example `anthropic/claude-opus-5.5`. The settings API rejects any other value with a 400.
