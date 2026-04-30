# @mastra/google-drive

## 0.1.0-alpha.1

### Patch Changes

- GoogleDriveFilesystem tweaks: mkdir defaults to recursive, appendFile uses optimistic concurrency, rmdir skips redundant child listing, JSON body requests include Content-Type header, readFile uses consistent searchParams, and concurrent token refreshes are deduplicated. ([#16010](https://github.com/mastra-ai/mastra/pull/16010))

- Updated dependencies [[`e109607`](https://github.com/mastra-ai/mastra/commit/e10960749251e34d46b480a20648c490fd30381b)]:
  - @mastra/core@1.31.0-alpha.1

## 0.1.0-alpha.0

### Minor Changes

- Add `@mastra/google-drive`, a new Google Drive `WorkspaceFilesystem` provider that mounts a single Drive folder as an agent workspace. Supports OAuth access tokens, async refresh callbacks, and service account (JWT) authentication. Implements the full `WorkspaceFilesystem` interface — read, write, list, copy, move, mkdir, rmdir, stat, exists — plus `expectedMtime` optimistic concurrency. ([#15756](https://github.com/mastra-ai/mastra/pull/15756))

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

### Patch Changes

- Updated dependencies [[`1723e09`](https://github.com/mastra-ai/mastra/commit/1723e099829892419ddbfe49287acfeac2522724), [`629f9e9`](https://github.com/mastra-ai/mastra/commit/629f9e9a7e56aa8f129515a3923c5813298790c7), [`25168fb`](https://github.com/mastra-ai/mastra/commit/25168fb9c1de9db7f8171df4f58ceb842c53aa29), [`ab34b5a`](https://github.com/mastra-ai/mastra/commit/ab34b5a2191b8e4353df1dbf7b9155e7d6628d79), [`5fb6c2a`](https://github.com/mastra-ai/mastra/commit/5fb6c2a95c1843cc231704b91354311fc1f34a71), [`394f0cf`](https://github.com/mastra-ai/mastra/commit/394f0cfc31e6b4d801219fdef2e9cc69e5bc8682), [`3d7f709`](https://github.com/mastra-ai/mastra/commit/3d7f709b615e588050bb6283c4ee5cfe2978cbde), [`48a42f1`](https://github.com/mastra-ai/mastra/commit/48a42f114a4006a95e0b7a1b5ad1a24815a175c2), [`2c83efc`](https://github.com/mastra-ai/mastra/commit/2c83efc4482b3efe50830e3b8b4ba9a8d219edff), [`282a10c`](https://github.com/mastra-ai/mastra/commit/282a10c9446e9922afe80e10e3770481c8ac8a28)]:
  - @mastra/core@1.31.0-alpha.0
