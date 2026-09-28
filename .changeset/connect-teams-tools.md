---
'@mastra/connect': minor
---

Added generated Microsoft Teams tools. 25 tools cover Graph API surface for chats, channels, teams, and messages (create/get/list/reply/update on chats, channel messages, chats, teams, tabs, and members). Sourced from NangoHQ/integration-templates' `microsoft-teams` template and wired into the `microsoft-teams` connection, so a single connection powers both the Teams channel (@mastra/teams) and these tools.

```ts
import { createMicrosoftTeamsTools } from '@mastra/connect';

const tools = createMicrosoftTeamsTools({ connectionId: 'conn_...' });
```

Tools call Microsoft Graph through the platform proxy, so the OAuth2 access token is injected automatically — no bot token or Dev Portal token needed for these operations.
