# @mastra/workspace

Workspace abstraction for Mastra agents - provides filesystem and code execution capabilities.

## Design Philosophy

This package follows an **interface-first** design:

- **Consumers** use factory functions that return interface types
- **Integrators** depend on contracts (interfaces), not implementations
- **Providers** extend base classes to implement new backends

## Installation

```bash
pnpm add @mastra/workspace
```

## Quick Start

```typescript
import {
  createMemoryWorkspace,
  type Workspace,
  type WorkspaceFilesystem,
} from '@mastra/workspace';

// Factory functions return interface types
const workspace: Workspace = await createMemoryWorkspace({
  id: 'my-workspace',
  scope: 'thread',
  agentId: 'my-agent',
  threadId: 'thread-123',
  withExecutor: true,
});

// Work with the Workspace interface
await workspace.writeFile('/code/app.js', 'console.log("Hello!");');
const code = await workspace.readFile('/code/app.js', { encoding: 'utf-8' });

// Execute code
const result = await workspace.executeCode('console.log("Hello!");', {
  runtime: 'node',
});
console.log(result.stdout); // "Hello!"

// Use key-value state
await workspace.state?.set('config', { debug: true });
const config = await workspace.state?.get('config');

// Cleanup
await workspace.destroy();
```

## Interface-First Pattern

### For Consumers

Use factory functions which return interface types:

```typescript
import { createMemoryWorkspace, type Workspace } from '@mastra/workspace';

// Get a Workspace interface - don't care about implementation
const workspace: Workspace = await createMemoryWorkspace({ scope: 'thread' });

// All operations go through the interface
await workspace.writeFile('/hello.txt', 'Hello!');
```

### For Integrators

Depend on interface types, not concrete implementations:

```typescript
import type { Workspace, WorkspaceFilesystem, WorkspaceExecutor } from '@mastra/workspace';

// Function accepts interface, works with any implementation
async function processWithWorkspace(workspace: Workspace) {
  const files = await workspace.readdir('/');
  // ...
}

// Or work with individual components
async function saveToFilesystem(fs: WorkspaceFilesystem, path: string, data: string) {
  await fs.writeFile(path, data);
}
```

### For Provider Implementers

Extend base classes to create new backends:

```typescript
import { BaseFilesystem, BaseExecutor } from '@mastra/workspace';
import type { WorkspaceFilesystem, FileStat, FileEntry } from '@mastra/workspace';

// Extend base class, implement abstract methods
export class MyCustomFilesystem extends BaseFilesystem {
  readonly id: string;
  readonly name = 'MyCustomFilesystem';
  readonly provider = 'custom';

  async readFile(path: string): Promise<string | Buffer> {
    // Your implementation
  }

  async writeFile(path: string, content: string | Buffer): Promise<void> {
    // Your implementation
  }

  // ... implement other abstract methods
}

// Register with factory (for custom setups)
```

## Workspace Types

### Memory Workspace

In-memory filesystem, great for testing and ephemeral operations:

```typescript
const workspace: Workspace = await createMemoryWorkspace({
  id: 'test-workspace',
  scope: 'thread',
  withExecutor: true, // Optional: enable code execution
  initialFiles: {
    // Optional: pre-populate files
    '/config.json': '{"initialized": true}',
  },
});
```

### Local Workspace

Uses the local filesystem and shell for execution:

```typescript
const workspace: Workspace = await createLocalWorkspace({
  id: 'local-workspace',
  basePath: '/path/to/workspace',
  scope: 'agent',
  agentId: 'my-agent',
});
```

### Custom Workspace

Full control over configuration:

```typescript
import { createWorkspace, type Workspace, type WorkspaceConfig } from '@mastra/workspace';

const config: WorkspaceConfig = {
  id: 'custom-workspace',
  scope: 'thread',
  filesystem: {
    provider: 'memory',
    id: 'custom-fs',
    initialFiles: {
      '/README.md': '# My Workspace',
    },
  },
  executor: {
    provider: 'local',
    id: 'custom-exec',
    defaultRuntime: 'node',
  },
};

const workspace: Workspace = await createWorkspace(config, {
  scope: 'thread',
  agentId: 'agent',
  threadId: 'thread',
});
```

## Core Interfaces

### Workspace

The main interface combining filesystem and executor:

```typescript
interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly scope: WorkspaceScope;
  readonly status: WorkspaceStatus;

  // Components (accessed via interface)
  readonly fs?: WorkspaceFilesystem;
  readonly executor?: WorkspaceExecutor;
  readonly state?: WorkspaceState;

  // Convenience methods
  readFile(path: string, options?: ReadOptions): Promise<string | Buffer>;
  writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void>;
  readdir(path: string, options?: ListOptions): Promise<FileEntry[]>;
  exists(path: string): Promise<boolean>;
  executeCode(code: string, options?: ExecuteCodeOptions): Promise<CodeResult>;
  executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult>;

  // Lifecycle
  init(): Promise<void>;
  destroy(): Promise<void>;
  snapshot(options?: SnapshotOptions): Promise<WorkspaceSnapshot>;
  restore(snapshot: WorkspaceSnapshot, options?: RestoreOptions): Promise<void>;
}
```

### WorkspaceFilesystem

Interface for file storage:

```typescript
interface WorkspaceFilesystem {
  readonly id: string;
  readonly name: string;
  readonly provider: string;

  readFile(path: string, options?: ReadOptions): Promise<string | Buffer>;
  writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void>;
  deleteFile(path: string, options?: RemoveOptions): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  rmdir(path: string, options?: RemoveOptions): Promise<void>;
  readdir(path: string, options?: ListOptions): Promise<FileEntry[]>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileStat>;
  // ...
}
```

### WorkspaceExecutor

Interface for code execution:

```typescript
interface WorkspaceExecutor {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly status: ExecutorStatus;
  readonly supportedRuntimes: readonly Runtime[];

  executeCode(code: string, options?: ExecuteCodeOptions): Promise<CodeResult>;
  executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult>;
  start(): Promise<void>;
  destroy(): Promise<void>;
  // ...
}
```

## Providers

### Built-in Filesystem Providers

| Provider | Description | Status |
| -------- | ----------- | ------ |
| `memory` | In-memory filesystem | ✅ Implemented |
| `local` | Local disk filesystem | ✅ Implemented |
| `agentfs` | AgentFS from Turso | 📋 Planned |
| `s3` | Amazon S3 | 📋 Planned |

### Built-in Executor Providers

| Provider | Description | Status |
| -------- | ----------- | ------ |
| `local` | Local shell execution | ✅ Implemented |
| `e2b` | E2B sandbox | 📋 Planned |
| `modal` | Modal sandbox | 📋 Planned |
| `docker` | Docker containers | 📋 Planned |
| `computesdk` | ComputeSDK unified API | 📋 Planned |

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
