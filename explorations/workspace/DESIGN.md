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
│  │  │   │  Built-in (@mastra/core):│   │  Built-in (@mastra/core):   │    │ │ │
│  │  │   │  ┌─────────────────┐    │   │  ┌─────────────────┐         │    │ │ │
│  │  │   │  │ • LocalFilesystem│   │   │  │ • LocalSandbox  │         │    │ │ │
│  │  │   │  └─────────────────┘    │   │  └─────────────────┘         │    │ │ │
│  │  │   │                         │   │                              │    │ │ │
│  │  │   │  External packages:     │   │  External packages:          │    │ │ │
│  │  │   │  ┌─────────────────┐    │   │  ┌─────────────────┐         │    │ │ │
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
5. **Built-in Basics** - LocalFilesystem and LocalSandbox are in `@mastra/core`
6. **External Providers** - Cloud/remote providers are separate packages

---

## Package Structure

```
@mastra/core                    # Core Workspace class, interfaces, AND local providers
├── src/workspace/
│   ├── workspace.ts           # Workspace class
│   ├── filesystem.ts          # WorkspaceFilesystem interface
│   ├── sandbox.ts             # WorkspaceSandbox interface
│   ├── local-filesystem.ts    # LocalFilesystem implementation
│   ├── local-sandbox.ts       # LocalSandbox implementation
│   └── index.ts               # Exports

# External provider packages (planned)
@mastra/filesystem-agentfs      # AgentFS - Turso-backed filesystem
@mastra/sandbox-computesdk      # ComputeSDK - E2B, Modal, Docker, etc.

explorations/workspace/         # Development/testing package
├── src/                       # Reference implementations for testing
```

---

## Usage

### Basic Usage

```typescript
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core';

// Create a workspace with local filesystem (folder on disk)
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './my-workspace' }),
  sandbox: new LocalSandbox({ workingDirectory: './my-workspace' }),
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

### Using External Providers (planned)

```typescript
import { Workspace } from '@mastra/core';
import { AgentFS } from '@mastra/filesystem-agentfs';
import { ComputeSDKSandbox } from '@mastra/sandbox-computesdk';

const workspace = new Workspace({
  filesystem: new AgentFS({ path: './agent.db' }),
  sandbox: new ComputeSDKSandbox({ provider: 'e2b' }),
});
```

---

## Filesystem Providers

| Provider | Package | Storage | Persistence | Best For |
|----------|---------|---------|-------------|----------|
| **LocalFilesystem** | `@mastra/core` | Disk folder | ✅ Yes | Development, local agents |
| **RamFilesystem** | `@mastra/workspace` | Memory | ❌ No | Testing, ephemeral workspaces |
| **AgentFS** (planned) | `@mastra/filesystem-agentfs` | SQLite/Turso | ✅ Yes | Production, audit trail |

### LocalFilesystem

Stores files in a folder on the user's machine. Built into `@mastra/core`.

```typescript
import { LocalFilesystem } from '@mastra/core';

const fs = new LocalFilesystem({
  basePath: './workspace',  // Files stored here
  sandbox: true,            // Prevent path traversal (default: true)
});
```

### RamFilesystem

In-memory filesystem for testing and ephemeral workspaces. Available in exploration package.

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

| Provider | Package | Isolation | Best For |
|----------|---------|-----------|----------|
| **LocalSandbox** | `@mastra/core` | ❌ None (host machine) | Development only |
| **ComputeSDKSandbox** (planned) | `@mastra/sandbox-computesdk` | ✅ Full | Production |

### LocalSandbox

Runs code directly on the host machine. Built into `@mastra/core`. **Only use for development.**

```typescript
import { LocalSandbox } from '@mastra/core';

const sandbox = new LocalSandbox({
  workingDirectory: './workspace',  // Working directory
  timeout: 30000,                   // Default timeout (ms)
});
```

### ComputeSDKSandbox (planned)

Uses ComputeSDK to access E2B, Modal, Docker, and other sandbox providers.

```typescript
import { ComputeSDKSandbox } from '@mastra/sandbox-computesdk';

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
  installPackage?(packageName: string, options?: InstallPackageOptions): Promise<InstallPackageResult>;

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

2. **LocalFilesystem in @mastra/core**
   - Folder-based storage on disk
   - Path traversal protection (sandbox mode)
   - Full POSIX-like operations

3. **LocalSandbox in @mastra/core**
   - Multi-runtime support (Node, Python, Bash, etc.)
   - Code and command execution
   - Package installation

4. **RamFilesystem (explorations package)**
   - In-memory filesystem for testing
   - Initial file seeding support

**Total: 50 passing tests (in explorations/workspace)**

### ✅ Agent Integration Complete

When you configure a workspace on an agent, the following tools are automatically injected:

**Filesystem tools** (when `filesystem` is configured):
- `workspace_read_file` - Read file contents
- `workspace_write_file` - Write content to a file
- `workspace_list_files` - List files in a directory
- `workspace_delete_file` - Delete a file
- `workspace_file_exists` - Check if a file exists
- `workspace_mkdir` - Create a directory

**Sandbox tools** (when `sandbox` is configured):
- `workspace_execute_code` - Execute code (Node.js, Python, shell, etc.)
- `workspace_execute_command` - Execute shell commands
- `workspace_install_package` - Install packages

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core';

// Create and initialize workspace
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './agent-workspace' }),
  sandbox: new LocalSandbox({ workingDirectory: './agent-workspace' }),
});
await workspace.init();

// Create agent with workspace - tools are auto-injected
const agent = new Agent({
  id: 'code-assistant',
  name: 'Code Assistant',
  model: 'openai/gpt-4',
  instructions: 'You are a helpful coding assistant with access to a workspace.',
  workspace,
});

// Agent now has access to workspace_read_file, workspace_write_file, etc.
const response = await agent.generate('Create a hello.txt file with "Hello World" content');
```

### 📋 Planned

1. **AgentFS provider** - Using `agentfs-sdk` from Turso
2. **ComputeSDKSandbox provider** - E2B, Modal, Docker, etc.
