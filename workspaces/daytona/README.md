# @mastra/daytona

Daytona cloud sandbox provider for [Mastra](https://mastra.ai) workspaces.

Implements the `WorkspaceSandbox` interface using [Daytona](https://www.daytona.io/) sandboxes. Supports multiple runtimes, resource configuration, volumes, snapshots, streaming output, sandbox reconnection, and filesystem mounting (S3, GCS, Azure Blob).

## Installation

```bash
npm install @mastra/daytona
```

## Usage

### Basic

```typescript
import { Workspace } from '@mastra/core/workspace';
import { DaytonaSandbox } from '@mastra/daytona';

const sandbox = new DaytonaSandbox({
  language: 'typescript',
  timeout: 60_000,
});

const workspace = new Workspace({ sandbox });
await workspace.init();

const result = await workspace.sandbox.executeCommand('echo', ['Hello!']);
console.log(result.stdout); // "Hello!"

await workspace.destroy();
```

## Documentation

- [Daytona integration guide](https://mastra.ai/integrations/sandboxes/daytona)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## R2 integration test

The opt-in S3 mount test creates billable Daytona sandboxes and disposable R2 objects. Use a dedicated test bucket with test-only credentials that can list, read, write, and delete its objects. The lifecycle checks also mount with those long-lived credentials; don't supply production credentials.

Prepare a Daytona snapshot containing Python and `boto3` before running the test. Pin Python dependencies when building the snapshot, and set `DAYTONA_R2_TEST_SNAPSHOT` to its name. You can omit this variable if your default snapshot already contains these dependencies. The test fails with setup instructions if they're missing; it doesn't install Python packages at runtime. Preinstalling `s3fs` also avoids the mount provider's existing runtime system-package installation.

Set `DAYTONA_API_KEY`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` in the repository-root `.env`, then run from the repository root:

```bash
DOTENV_CONFIG_PATH="$PWD/.env" \
RUN_R2_ISOLATION_TEST=1 \
DAYTONA_R2_TEST_SNAPSHOT=your-prepared-snapshot \
pnpm --filter @mastra/daytona exec vitest run src/sandbox/mounts/s3-r2.integration.test.ts
```

The test checks cross-prefix access denial, mount recovery, credential cleanup, sandbox deletion, and removal of its test objects.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/daytona/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
