---
'@mastra/code-sdk': patch
'@mastra/factory': patch
---

Factory sessions now recover when a provider rejects your personal sign-in before its recorded expiry, for example after Anthropic revokes the access token. The session refreshes your stored credential once and retries the request, so you no longer have to sign in again. The new token is saved, so later and resumed sessions use it too. When several sessions hit the rejection at the same moment, only one of them spends the refresh token and the others reuse its result.
