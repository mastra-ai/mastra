---
'@mastra/code-sdk': patch
'@mastra/factory': patch
---

Fixed Factory sessions failing with a sign-in error when a provider such as OpenAI Codex or Anthropic rejects a personal OAuth token before its saved expiry.

- The session now refreshes the stored credential once and retries the request, so you don't need to sign in again.
- Later and resumed sessions use the new token.
- Sessions that hit the rejection at the same time share a single refresh.
