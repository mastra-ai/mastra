---
'@mastra/connect': minor
---

Added a Microsoft PowerPoint toolset with 18 tools for drive discovery, presentation creation, listing, retrieval, copying, moving, updating, deletion, sharing, versions, thumbnails, and content export.

```ts
import { tools } from '@mastra/connect';

const powerpointTools = await tools({ providers: ['microsoft-powerpoint'] })();
const drive = await powerpointTools.microsoft_powerpoint_get_user_drive.execute({});
const presentations = await powerpointTools.microsoft_powerpoint_list_presentations.execute({ drive_id: drive.id });
```
