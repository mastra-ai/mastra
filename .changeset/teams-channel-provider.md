---
'@mastra/teams': minor
---

Added @mastra/teams, a Microsoft Teams channel provider. Register TeamsProvider on Mastra.channels to route Teams conversations to agents with streaming replies. Supports self-managed bot credentials (appId/appPassword) or a delegated scope-aware tokenResolver that provisions a dedicated bot per agent through Microsoft Graph and the Teams Developer Portal.
