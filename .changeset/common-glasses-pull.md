---
'@mastra/slack': minor
---

Added a tokenResolver option to SlackProvider for externally managed credentials. When set, the provider asks the resolver for a fresh App Configuration access token before each manifest API call and never calls tooling.tokens.rotate itself, so an external credential manager (like the Mastra platform) can own the token refresh cycle. refreshToken, configure(), and stored config tokens are not used in this mode.
