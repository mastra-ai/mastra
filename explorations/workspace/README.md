# @mastra/workspace

Workspace exploration and test suite for Mastra agents.

## Overview

The Workspace abstraction provides filesystem and sandbox capabilities for agents.

- **Workspace class** → `@mastra/core`
- **LocalFilesystem** → `@mastra/core` (built-in)
- **LocalSandbox** → `@mastra/core` (built-in)
- **RamFilesystem** → This package (for testing)
- **External providers** → Separate packages (AgentFS, ComputeSDK, etc.)

## Quick Start

### Standalone Workspace

```typescript
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core';

// Create a workspace with local filesystem and sandbox
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './my-workspace' }),
  sandbox: new LocalSandbox({ workingDirectory: './my-workspace' }),
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

### With an Agent (Auto Tool Injection)

When you configure a workspace on an agent, workspace tools are automatically available:

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core';

// Create and initialize workspace
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './agent-workspace' }),
  sandbox: new LocalSandbox({ workingDirectory: './agent-workspace' }),
});
await workspace.init();

// Create agent with workspace
const agent = new Agent({
  id: 'code-assistant',
  name: 'Code Assistant',
  model: 'openai/gpt-4',
  instructions: 'You are a helpful coding assistant.',
  workspace,
});

// Agent automatically has access to:
// - workspace_read_file
// - workspace_write_file
// - workspace_list_files
// - workspace_delete_file
// - workspace_file_exists
// - workspace_mkdir
// - workspace_execute_code
// - workspace_execute_command
// - workspace_install_package

const response = await agent.generate('Create a hello.txt file with "Hello World"');
```

## Available Providers

### Built-in (in @mastra/core)

| Provider | Description | Best For |
|----------|-------------|----------|
| `LocalFilesystem` | Folder on disk | Development, local agents |
| `LocalSandbox` | Host machine execution | Development only ⚠️ |

### In This Package (explorations)

| Provider | Description | Best For |
|----------|-------------|----------|
| `RamFilesystem` | In-memory (ephemeral) | Testing, temp workspaces |

### External Packages (Available)

| Provider | Package | Description |
|----------|---------|-------------|
| `AgentFilesystem` | `@mastra/filesystem-agentfs` | Turso-backed with audit trail |
| `ComputeSDKSandbox` | `@mastra/sandbox-computesdk` | E2B, Modal, Railway, etc. |

## LocalFilesystem

Built into `@mastra/core`. Stores files in a folder on the user's machine.

```typescript
import { LocalFilesystem } from '@mastra/core';

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

## LocalSandbox

Built into `@mastra/core`. Runs code directly on the host machine.

⚠️ **Warning:** Only use for development. For production, use ComputeSDKSandbox.

```typescript
import { LocalSandbox } from '@mastra/core';

const sandbox = new LocalSandbox({
  workingDirectory: './workspace',  // Optional: working directory
  timeout: 30000,                   // Optional: default timeout (ms)
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

## External Provider Packages

### AgentFilesystem

Turso-backed filesystem with full audit trail.

```typescript
import { Workspace } from '@mastra/core';
import { AgentFilesystem } from '@mastra/filesystem-agentfs';

const workspace = new Workspace({
  filesystem: new AgentFilesystem({ id: 'my-agent' }),
});

await workspace.init();
await workspace.writeFile('/data.json', '{"key": "value"}');
```

### ComputeSDKSandbox

Secure cloud execution via E2B, Modal, Railway, and other providers.

```typescript
import { Workspace } from '@mastra/core';
import { ComputeSDKSandbox } from '@mastra/sandbox-computesdk';

const workspace = new Workspace({
  sandbox: new ComputeSDKSandbox({
    provider: 'e2b',  // or modal, railway, daytona, vercel...
    apiKey: process.env.COMPUTESDK_API_KEY,
  }),
});

await workspace.init();

// Execute code securely in the cloud
const result = await workspace.executeCode('print("Hello!")', { runtime: 'python' });
```

Supported providers: e2b, modal, railway, daytona, vercel, runloop, cloudflare, codesandbox, blaxel

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
