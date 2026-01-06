# @mastra/workspace

Workspace providers for Mastra agents - filesystem and sandbox capabilities.

## Design Philosophy

This package provides **provider implementations** for the Workspace class in `@mastra/core`.

- **Workspace class** → lives in `@mastra/core`
- **Providers** → separate packages (this one and future packages)
- **Instance-based API** → users pass provider instances, not config objects

## Installation

```bash
pnpm add @mastra/workspace
```

## Quick Start

```typescript
import { Workspace } from '@mastra/core';
import { LocalFilesystem, LocalSandbox } from '@mastra/workspace';

// Create a workspace with local filesystem (folder on disk)
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './my-workspace' }),
  sandbox: new LocalSandbox(),
});

await workspace.init();

// File operations
await workspace.writeFile('/code/app.js', 'console.log("Hello!")');
const code = await workspace.readFile('/code/app.js', { encoding: 'utf-8' });

// Execute code
const result = await workspace.executeCode('console.log("Hello!")', {
  runtime: 'node',
});
console.log(result.stdout); // "Hello!"

// Cleanup
await workspace.destroy();
```

## Available Providers

### Filesystem Providers

| Provider | Description | Best For |
|----------|-------------|----------|
| `LocalFilesystem` | Folder on disk | Development, local agents |
| `RamFilesystem` | In-memory (ephemeral) | Testing, temp workspaces |

### Sandbox Providers

| Provider | Description | Best For |
|----------|-------------|----------|
| `LocalSandbox` | Host machine execution | Development only ⚠️ |

## LocalFilesystem

Stores files in a folder on the user's machine.

```typescript
import { LocalFilesystem } from '@mastra/workspace';

const fs = new LocalFilesystem({
  basePath: './workspace',  // Required: base directory
  sandbox: true,            // Optional: prevent path traversal (default: true)
});

await fs.init();

// File operations
await fs.writeFile('/hello.txt', 'Hello World!');
const content = await fs.readFile('/hello.txt', { encoding: 'utf-8' });

// Directory operations
await fs.mkdir('/data');
const entries = await fs.readdir('/');
```

## RamFilesystem

In-memory filesystem for testing. Data is lost when process exits.

```typescript
import { RamFilesystem } from '@mastra/workspace';

const fs = new RamFilesystem({
  initialFiles: {
    '/config.json': '{"debug": true}',
    '/README.md': '# My Workspace',
  },
});

// Use like any other filesystem
await fs.writeFile('/data.txt', 'content');
```

## LocalSandbox

Runs code directly on the host machine.

⚠️ **Warning:** Only use for development. For production, use ComputeSDKSandbox.

```typescript
import { LocalSandbox } from '@mastra/workspace';

const sandbox = new LocalSandbox({
  cwd: './workspace',        // Optional: working directory
  timeout: 30000,            // Optional: default timeout (ms)
  defaultRuntime: 'node',    // Optional: default runtime
});

await sandbox.start();

// Execute code
const result = await sandbox.executeCode('console.log("Hello!")', {
  runtime: 'node',
});

// Execute commands
const cmdResult = await sandbox.executeCommand('echo', ['Hello', 'World']);

await sandbox.destroy();
```

## Planned Providers

### AgentFS

Turso-backed filesystem with full audit trail.

```typescript
// Coming soon
import { AgentFS } from '@mastra/workspace-fs-agentfs';

const fs = new AgentFS({ path: './agent.db' });
```

### ComputeSDKSandbox

Access to E2B, Modal, Docker, and other sandbox providers via ComputeSDK.

```typescript
// Coming soon
import { ComputeSDKSandbox } from '@mastra/workspace-sandbox-computesdk';

const sandbox = new ComputeSDKSandbox({
  provider: 'e2b',  // or 'modal', 'docker', etc.
});
```

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Type check
pnpm typecheck

# Build
pnpm build
```

## License

MIT
