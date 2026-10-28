---
'@mastra/connect': minor
---

Added a Microsoft Outlook toolset with 30 tools for messages, replies, drafts, attachments, mail folders, calendars, and events.

```ts
import { tools } from '@mastra/connect';

const outlookTools = await tools({ providers: ['outlook'] })();
const inbox = await outlookTools.outlook_list_messages.execute({ folderId: 'inbox', limit: 10 });
```
