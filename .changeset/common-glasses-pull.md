---
'@mastra/slack': minor
---

Added a `tokenResolver` option to `SlackProvider` for externally managed credentials. When set, the provider fetches a fresh App Configuration access token through the resolver before each manifest API call instead of rotating tokens itself, letting an external credential manager (like the Mastra platform) own the refresh cycle.
