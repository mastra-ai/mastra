# @mastra/google-drive

Google Drive filesystem provider for Mastra workspaces. Mounts a Google Drive folder as an agent workspace, exposing it through the standard `WorkspaceFilesystem` interface so agents can read, write, list, copy, move, and delete files in Drive.

## Installation

```bash
npm install @mastra/google-drive
```

## Usage

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
  name: 'my-agent',
  model: 'anthropic/claude-opus-4-5',
  workspace,
});
```

## Authentication

Supply one of:

- **`accessToken`** — A pre-obtained OAuth access token (use the `https://www.googleapis.com/auth/drive` scope).
- **`getAccessToken`** — A callback that returns a token; useful when tokens are refreshed externally.
- **`serviceAccount`** — A Google service account. Share the target folder with the service account email.

```typescript
new GoogleDriveFilesystem({
  folderId: process.env.GOOGLE_DRIVE_FOLDER_ID!,
  serviceAccount: {
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY!,
  },
});
```

## Documentation

For more information, see the [Mastra Workspaces documentation](https://mastra.ai/docs/workspace/overview) and the [GoogleDriveFilesystem reference](https://mastra.ai/reference/workspace/google-drive-filesystem).
