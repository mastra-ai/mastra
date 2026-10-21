---
'@mastra/connect': minor
---

Added a Microsoft Word toolset with 18 tools for drive discovery, document creation, copying, updating, deletion, moving, sharing, and export.

```ts
import { tools } from '@mastra/connect';

const wordTools = await tools({ providers: ['microsoft-word'] })();
const drive = await wordTools.microsoft_word_get_user_drive.execute({});
const documents = await wordTools.microsoft_word_list_word_documents.execute({ driveId: drive.id });
```
