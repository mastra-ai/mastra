---
'@mastra/server': patch
---

Added a startup warning when `server.auth` is configured without `mapUserToResourceId`. Without that callback, built-in routes trust the resource ID sent by the client (for example `memory.resource`), so an authenticated user could read or write threads belonging to another user. Configure `mapUserToResourceId` to derive the resource ID from the authenticated user. Fixes [#22875](https://github.com/mastra-ai/mastra/issues/22875).
