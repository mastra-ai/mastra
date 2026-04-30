---
'@mastra/google-drive': minor
---

Add `@mastra/google-drive`, a new Google Drive `WorkspaceFilesystem` provider that mounts a single Drive folder as an agent workspace. Supports OAuth access tokens, async refresh callbacks, and service account (JWT) authentication. Implements the full `WorkspaceFilesystem` interface — read, write, list, copy, move, mkdir, rmdir, stat, exists — plus `expectedMtime` optimistic concurrency.

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { GoogleDriveFilesystem } from '@mastra/google-drive';

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

A matching `googleDriveFilesystemProvider` descriptor is also exported for MastraEditor.
