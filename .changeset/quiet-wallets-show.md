---
'mastra': patch
'@mastra/factory': patch
---

Factory sessions now show which credential the next reply runs on, right after the model under the composer: the provider's logo with a small badge for who holds the credential, a building for the organization or the session owner's avatar. Hover or focus it to read the credential and its holder by role, such as "Claude Pro/Max · Shane Thomas · session owner" or "Anthropic API key · Shared by the organization". In a teammate's session it also warns "Your messages use Shane Thomas’s Claude Pro/Max". It shows on a new session too, so you know whose credential a reply uses before you send the first message.

`GET /web/config/models` now returns a `credentialLabel` for each model when it can name the credential the model runs on, such as `"Claude Pro/Max"` or `"OpenAI API key"`.
