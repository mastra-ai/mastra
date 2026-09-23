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

## Documentation

- [Google Drive integration guide](https://mastra.ai/integrations/file-storage/google-drive)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/google-drive/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
