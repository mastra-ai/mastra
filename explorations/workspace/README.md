# @mastra/workspace

Workspace abstraction for Mastra agents - provides filesystem and code execution capabilities.

## Overview

The workspace package provides agents with:

- **Filesystem** - Read, write, and manage files
- **Executor** - Run code in sandboxed environments
- **State** - Key-value storage for agent state
- **Snapshots** - Save and restore workspace state

## Installation

```bash
pnpm add @mastra/workspace
```

## Quick Start

```typescript
import { createMemoryWorkspace } from '@mastra/workspace';

// Create an in-memory workspace with code execution
const workspace = await createMemoryWorkspace({
  id: 'my-workspace',
  scope: 'thread',
  agentId: 'my-agent',
  threadId: 'thread-123',
  withExecutor: true,
});

// Write and read files
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

## Workspace Types

### Memory Workspace

In-memory filesystem, great for testing and ephemeral operations:

```typescript
const workspace = await createMemoryWorkspace({
  id: 'test-workspace',
  scope: 'thread',
  withExecutor: true,
});
```

### Local Workspace

Uses the local filesystem and shell for execution:

```typescript
const workspace = await createLocalWorkspace({
  id: 'local-workspace',
  basePath: '/path/to/workspace',
  scope: 'agent',
  agentId: 'my-agent',
});
```

### Custom Workspace

Full control over configuration:

```typescript
const workspace = await createWorkspace(
  {
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
  },
  { scope: 'thread', agentId: 'agent', threadId: 'thread' },
);
```

## Workspace Scopes

Workspaces can be scoped at different levels:

- **`agent`** - Shared across all threads for an agent
- **`thread`** - Isolated per conversation thread
- **`global`** - Shared across all agents (coming soon)

## Features

### File Operations

```typescript
// Write files
await workspace.writeFile('/path/file.txt', 'content');

// Read files
const content = await workspace.readFile('/path/file.txt', { encoding: 'utf-8' });

// List directory
const files = await workspace.readdir('/path');

// Check existence
const exists = await workspace.exists('/path/file.txt');
```

### Code Execution

```typescript
// Execute code
const result = await workspace.executeCode('print("Hello")', {
  runtime: 'python',
  timeout: 30000,
});

// Execute shell commands
const cmdResult = await workspace.executeCommand('ls', ['-la']);
```

### State Management

```typescript
// Set state
await workspace.state?.set('key', { value: 42 });

// Get state
const value = await workspace.state?.get<{ value: number }>('key');

// Check if exists
const has = await workspace.state?.has('key');

// Delete
await workspace.state?.delete('key');
```

### Snapshots

```typescript
// Create snapshot
const snapshot = await workspace.snapshot({ name: 'checkpoint' });

// Restore from snapshot
await workspace.restore(snapshot);
```

## Providers

### Filesystem Providers

- `memory` - In-memory filesystem (included)
- `local` - Local filesystem (included)
- `agentfs` - AgentFS from Turso (coming soon)
- `s3` - Amazon S3 (coming soon)

### Executor Providers

- `local` - Local shell execution (included)
- `e2b` - E2B sandbox (coming soon)
- `modal` - Modal sandbox (coming soon)
- `docker` - Docker containers (coming soon)
- `computesdk` - ComputeSDK unified API (coming soon)

## API Reference

### Core Interfaces

```typescript
interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly scope: WorkspaceScope;
  readonly status: WorkspaceStatus;

  // Components
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
  pause(): Promise<void>;
  resume(): Promise<void>;
  snapshot(options?: SnapshotOptions): Promise<WorkspaceSnapshot>;
  restore(snapshot: WorkspaceSnapshot, options?: RestoreOptions): Promise<void>;
}
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
