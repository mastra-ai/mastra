---
'mastracode': patch
---

Fixed claude-fable-5 requests failing with "Invalid request: fallbacks: Extra inputs are not permitted" when logged in with Claude Max OAuth. The OAuth fetch wrapper was overwriting the anthropic-beta header, dropping the server-side-fallback beta that the automatic fable-5 fallback configuration requires. Request betas are now merged with the OAuth-required betas instead of being replaced.
