---
'@mastra/connect': minor
---

Added 25 Microsoft Teams tools. Areas covered:

- **Teams** — create, get, list joined teams, list members, add and remove members
- **Channels** — create, get, list, update, delete
- **Channel messages** — send, get, list, reply, list replies
- **Channel tabs** — create, list
- **Chats** — create, get, list, send messages, get message, list messages, list members

One `microsoft-teams` connection powers both these tools and the Teams channel — no extra bot token or app registration to wire up.

```ts
import { createMicrosoftTeamsTools } from '@mastra/connect';

const tools = createMicrosoftTeamsTools({ connectionId: 'conn_...' });
```
