---
'@mastra/factory': patch
'@mastra/code-sdk': patch
---

Fixed observational memory defaulting to a Google model no matter which provider you connected. Signing in or saving an API key now seeds the observer and reflector models from that provider — Anthropic gives you `anthropic/claude-haiku-4-5`, OpenAI gives you `openai/gpt-5.4-mini` — instead of leaving them on `google/gemini-3.5-flash` and failing at run time. Providers without a low-cost model are left unset rather than pinned to a full-size coding model, and a model you picked yourself is never overwritten.

**Switching one role no longer pins the other**

Changing the observer model used to silently persist whatever the reflector happened to be running, turning an inherited default into a choice you never made. Only the role you change is written now.

**The settings page tells you when a model can't run**

`GET /web/config/om` and `PUT /web/config/om/:role/model` now report whether each role's provider has credentials, and the memory settings section warns per role — naming the provider to connect — instead of letting the run fail with an opaque error. The model change is still accepted: the warning never blocks it.
