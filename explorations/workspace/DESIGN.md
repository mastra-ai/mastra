# Agent Workspace Design

A **Workspace** is composed of two core abstractions:
1. **Filesystem (FS)** - Where the agent stores and retrieves files
2. **Sandbox** - Where the agent runs code and commands

Both are optional but at least one must be present for a workspace to be useful.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Mastra                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                              Agent                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                         Workspace                                    │ │ │
│  │  │                                                                      │ │ │
│  │  │   ┌─────────────────────────┐   ┌──────────────────────────────┐    │ │ │
│  │  │   │      Filesystem         │   │         Sandbox              │    │ │ │
│  │  │   │  (provider instance)    │   │    (provider instance)       │    │ │ │
│  │  │   │                         │   │                              │    │ │ │
│  │  │   │  Implementations:       │   │  Implementations:            │    │ │ │
│  │  │   │  ┌─────────────────┐    │   │  ┌─────────────────┐         │    │ │ │
│  │  │   │  │ • LocalFilesystem│   │   │  │ • LocalSandbox  │         │    │ │ │
│  │  │   │  │ • AgentFS        │   │   │  │ • ComputeSDK    │         │    │ │ │
│  │  │   │  │ • RamFilesystem  │   │   │  │   (E2B, Modal,  │         │    │ │ │
│  │  │   │  └─────────────────┘    │   │  │    Docker...)   │         │    │ │ │
│  │  │   │                         │   │  └─────────────────┘         │    │ │ │
│  │  │   └─────────────────────────┘   └──────────────────────────────┘    │ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Design Principles

1. **Provider Agnostic** - Interfaces don't assume implementation details
2. **Instance-Based** - Users pass provider instances directly to Workspace
3. **Composable** - Mix any FS provider with any Sandbox provider
4. **Optional Components** - Workspace can have just FS, just Sandbox, or both
5. **Core in Core** - Workspace class lives in `@mastra/core`, providers are separate packages

---

## Package Structure

```
@mastra/core                    # Core Workspace class and interfaces
├── src/workspace/
│   ├── workspace.ts           # Workspace class
│   ├── filesystem.ts          # WorkspaceFilesystem interface
│   ├── sandbox.ts             # WorkspaceSandbox interface
│   └── index.ts               # Exports

@mastra/workspace              # Reference implementations (this package)
├── src/
│   ├── types.ts               # Type definitions
│   ├── filesystem/
│   │   └── providers/
│   │       ├── local.ts       # LocalFilesystem - folder on disk
│   │       └── ram.ts         # RamFilesystem - in-memory (ephemeral)
│   └── sandbox/
│       └── providers/
│           └── local.ts       # LocalSandbox - host machine execution

@mastra/workspace-fs-agentfs   # AgentFS from Turso (planned)
@mastra/workspace-sandbox-computesdk  # ComputeSDK integration (planned)
```

---

## Usage

### Basic Usage

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
await workspace.writeFile('/hello.txt', 'Hello World!');
const content = await workspace.readFile('/hello.txt', { encoding: 'utf-8' });

// Code execution
const result = await workspace.executeCode('console.log("Hi")', { runtime: 'node' });
console.log(result.stdout); // "Hi"

await workspace.destroy();
```

### Using AgentFS (planned)

```typescript
import { Workspace } from '@mastra/core';
import { AgentFS } from '@mastra/workspace-fs-agentfs';
import { ComputeSDKSandbox } from '@mastra/workspace-sandbox-computesdk';

const workspace = new Workspace({
  filesystem: new AgentFS({ path: './agent.db' }),
  sandbox: new ComputeSDKSandbox({ provider: 'e2b' }),
});
```

---

## Filesystem Providers

| Provider | Storage | Persistence | Best For |
|----------|---------|-------------|----------|
| **LocalFilesystem** | Disk folder | ✅ Yes | Development, local agents |
| **RamFilesystem** | Memory | ❌ No | Testing, ephemeral workspaces |
| **AgentFS** (planned) | SQLite/Turso | ✅ Yes | Production, audit trail |

### LocalFilesystem

Stores files in a folder on the user's machine. This is the recommended filesystem for development.

```typescript
import { LocalFilesystem } from '@mastra/workspace';

const fs = new LocalFilesystem({
  basePath: './workspace',  // Files stored here
  sandbox: true,            // Prevent path traversal (default: true)
});
```

### RamFilesystem

In-memory filesystem for testing and ephemeral workspaces. Data is lost when the process exits.

```typescript
import { RamFilesystem } from '@mastra/workspace';

const fs = new RamFilesystem({
  initialFiles: {
    '/config.json': '{"initialized": true}',
  },
});
```

---

## Sandbox Providers

| Provider | Isolation | Best For |
|----------|-----------|----------|
| **LocalSandbox** | ❌ None (host machine) | Development only |
| **ComputeSDKSandbox** (planned) | ✅ Full | Production |

### LocalSandbox

Runs code directly on the host machine. **Only use for development.**

```typescript
import { LocalSandbox } from '@mastra/workspace';

const sandbox = new LocalSandbox({
  cwd: './workspace',        // Working directory
  timeout: 30000,            // Default timeout (ms)
  defaultRuntime: 'node',    // Default runtime
});
```

### ComputeSDKSandbox (planned)

Uses ComputeSDK to access E2B, Modal, Docker, and other sandbox providers.

```typescript
import { ComputeSDKSandbox } from '@mastra/workspace-sandbox-computesdk';

const sandbox = new ComputeSDKSandbox({
  provider: 'e2b',  // or 'modal', 'docker', etc.
});
```

---

## Interface Summary

### WorkspaceFilesystem

```typescript
interface WorkspaceFilesystem {
  readonly id: string;
  readonly name: string;
  readonly provider: string;

  // File operations
  readFile(path: string, options?: ReadOptions): Promise<string | Buffer>;
  writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void>;
  appendFile(path: string, content: FileContent): Promise<void>;
  deleteFile(path: string, options?: RemoveOptions): Promise<void>;
  copyFile(src: string, dest: string, options?: CopyOptions): Promise<void>;
  moveFile(src: string, dest: string, options?: CopyOptions): Promise<void>;

  // Directory operations
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  rmdir(path: string, options?: RemoveOptions): Promise<void>;
  readdir(path: string, options?: ListOptions): Promise<FileEntry[]>;

  // Path operations
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileStat>;
  isFile(path: string): Promise<boolean>;
  isDirectory(path: string): Promise<boolean>;

  // Lifecycle
  init?(): Promise<void>;
  destroy?(): Promise<void>;
}
```

### WorkspaceSandbox

```typescript
interface WorkspaceSandbox {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly status: SandboxStatus;
  readonly supportedRuntimes: readonly SandboxRuntime[];
  readonly defaultRuntime: SandboxRuntime;

  // Code execution
  executeCode(code: string, options?: ExecuteCodeOptions): Promise<CodeResult>;
  executeCodeStream?(code: string, options?: ExecuteCodeOptions): Promise<StreamingExecutionResult>;

  // Command execution
  executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult>;
  executeCommandStream?(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<StreamingExecutionResult>;

  // Package management
  installPackage?(packageName: string, options?: InstallPackageOptions): Promise<void>;

  // Lifecycle
  start(): Promise<void>;
  stop?(): Promise<void>;
  destroy(): Promise<void>;
  isReady(): Promise<boolean>;
  getInfo(): Promise<SandboxInfo>;
}
```

### Workspace

```typescript
class Workspace {
  readonly id: string;
  readonly name: string;
  readonly status: WorkspaceStatus;
  readonly filesystem?: WorkspaceFilesystem;
  readonly sandbox?: WorkspaceSandbox;
  readonly state?: WorkspaceState;

  constructor(config: WorkspaceConfig);

  // Convenience methods (delegate to providers)
  readFile(path: string, options?: ReadOptions): Promise<string | Buffer>;
  writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void>;
  readdir(path: string, options?: ListOptions): Promise<FileEntry[]>;
  exists(path: string): Promise<boolean>;
  executeCode(code: string, options?: ExecuteCodeOptions): Promise<CodeResult>;
  executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult>;

  // Sync operations
  syncToSandbox(paths?: string[]): Promise<SyncResult>;
  syncFromSandbox(paths?: string[]): Promise<SyncResult>;

  // Snapshots
  snapshot(options?: SnapshotOptions): Promise<WorkspaceSnapshot>;
  restore(snapshot: WorkspaceSnapshot, options?: RestoreOptions): Promise<void>;

  // Lifecycle
  init(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  destroy(): Promise<void>;
  getInfo(): Promise<WorkspaceInfo>;
}
```

---

## Implementation Status

### ✅ Completed

1. **Workspace class in @mastra/core**
   - Full Workspace implementation with filesystem and sandbox support
   - Key-value state backed by filesystem
   - Snapshot and restore capabilities
   - Sync between filesystem and sandbox

2. **LocalFilesystem provider**
   - Folder-based storage on disk
   - Path traversal protection (sandbox mode)
   - Full POSIX-like operations

3. **RamFilesystem provider**
   - In-memory filesystem for testing
   - Initial file seeding support

4. **LocalSandbox provider**
   - Multi-runtime support (Node, Python, Bash, etc.)
   - Code and command execution
   - Streaming output support

**Total: 50 passing tests**

### 📋 Planned

1. **AgentFS provider** - Using `agentfs-sdk` from Turso
2. **ComputeSDKSandbox provider** - E2B, Modal, Docker, etc.
3. **Agent integration** - Add `workspace` config to AgentConfig
4. **Auto tool injection** - Inject workspace tools when workspace is configured
