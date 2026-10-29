---
'@mastra/code-sdk': patch
'@mastra/factory': patch
---

Fixed deployed sessions failing with a sign-in error when a provider rejects a saved OAuth token before its recorded expiry. Factory now refreshes the tenant's Anthropic or OpenAI Codex credential once and retries the request with the new token. If another server already refreshed the credential, the newer token is reused instead of rotating the refresh token again.
