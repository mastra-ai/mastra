---
'@mastra/connect': patch
---

Added Microsoft Teams to channels(). Projects with an active microsoft-teams platform connection now resolve a TeamsProvider automatically. The provider runs in delegated mode with a scope-aware token resolver: Microsoft Graph tokens come from the connection credential, and Teams Developer Portal tokens come from the connection's devPortalAccessToken (minted when the integration requests the dev.teams.microsoft.com/AppDefinitions.ReadWrite scope).
