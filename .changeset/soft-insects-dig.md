---
'@mastra/core': minor
---

Added GoogleDriveFilesystem workspace provider. Mount a Google Drive folder as an agent workspace using OAuth access tokens, a refresh callback, or a service account.

```typescript
import { Agent } from '@mastra/core/agent';
import { GoogleDriveFilesystem, Workspace } from '@mastra/core/workspace';

const workspace = new Workspace({
  filesystem: new GoogleDriveFilesystem({
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID!,
    accessToken: process.env.GOOGLE_DRIVE_ACCESS_TOKEN!,
  }),
});

const agent = new Agent({
  id: 'drive-agent',
  name: 'Drive Agent',
  model: 'openai/gpt-4o-mini',
  workspace,
});
```
