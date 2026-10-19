---
'mastra': patch
'@mastra/factory': patch
---

Factory sessions now show which credential the next reply runs on, as an icon right after the model under the composer: a building for the organization, or the owner's avatar for a personal credential. Hover or focus it to read the same label shown under each reply, such as "Organization Anthropic API key", "Your Claude Pro/Max", or "Shane Thomas’s Claude Pro/Max" in a teammate's session. It shows on a new session too, so you know whose credential a reply uses before you send the first message.

`GET /web/config/models` now returns a `credentialLabel` for each model when it can name the credential the model runs on, such as `"Claude Pro/Max"` or `"OpenAI API key"`.
