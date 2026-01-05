# Agent Workspace Design

A **Workspace** is composed of two core abstractions:
1. **Filesystem (FS)** - Where the agent stores and retrieves files and state
2. **Executor** - Where the agent runs code and commands

Both are optional but at least one must be present for a workspace to be useful.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Mastra                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                              Agent                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                     Workspace Manager                                │ │ │
│  │  │                                                                      │ │ │
│  │  │   ┌─────────────────────┐    ┌──────────────────────────────────┐   │ │ │
│  │  │   │  Agent Workspace    │    │      Thread Workspaces           │   │ │ │
│  │  │   │  (scope: agent)     │    │      (scope: thread)             │   │ │ │
│  │  │   │                     │    │                                  │   │ │ │
│  │  │   │  Shared across      │    │  ┌──────────┐  ┌──────────┐     │   │ │ │
│  │  │   │  all threads        │    │  │ Thread A │  │ Thread B │ ... │   │ │ │
│  │  │   │                     │    │  │ Workspace│  │ Workspace│     │   │ │ │
│  │  │   └─────────────────────┘    │  └──────────┘  └──────────┘     │   │ │ │
│  │  │                              └──────────────────────────────────┘   │ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        Workspace                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐   │
│  │      Filesystem         │  │       Executor          │   │
│  │   (WorkspaceFilesystem) │  │   (WorkspaceExecutor)   │   │
│  │                         │  │                         │   │
│  │  Providers:             │  │  Providers:             │   │
│  │  ┌─────────────────┐    │  │  ┌─────────────────┐    │   │
│  │  │ • AgentFS       │    │  │  │ • E2B           │    │   │
│  │  │ • LocalFS       │    │  │  │ • Modal         │    │   │
│  │  │ • MemoryFS      │    │  │  │ • Docker        │    │   │
│  │  │ • S3            │    │  │  │ • Daytona       │    │   │
│  │  │ • Custom...     │    │  │  │ • Local         │    │   │
│  │  └─────────────────┘    │  │  │ • ComputeSDK    │    │   │
│  │                         │  │  └─────────────────┘    │   │
│  └─────────────────────────┘  └─────────────────────────┘   │
│                                                              │
│  Optional:                                                   │
│  ┌─────────────────────────┐  ┌─────────────────────────┐   │
│  │   State (KV Store)      │  │      Audit Trail        │   │
│  │   (WorkspaceState)      │  │   (WorkspaceAudit)      │   │
│  └─────────────────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Design Principles

1. **Provider Agnostic** - Interfaces don't assume implementation details
2. **Composable** - Mix any FS provider with any Executor provider
3. **Optional Components** - Workspace can have just FS, just Executor, or both
4. **Syncable** - When both exist, files can sync between them
5. **Auditable** - Operations can be logged/tracked
6. **Scoped** - Workspaces can be agent-level, thread-level, or both

---

## Workspace Scopes

### Agent-Level Workspace (`scope: 'agent'`)
- Shared across all conversation threads for an agent
- Persists for the lifetime of the agent
- Good for: shared knowledge, templates, accumulated learnings

### Thread-Level Workspace (`scope: 'thread'`)
- Isolated per conversation thread
- Created when thread starts, destroyed when thread ends (or times out)
- Good for: code review, one-off tasks, security isolation

### Hybrid Workspace (`scope: 'hybrid'`)
- Both agent-level and thread-level workspaces
- Agent workspace mounted at `/shared`, thread workspace at `/project`
- Good for: development environments, shared + isolated needs

---

## Interface Summary

### `WorkspaceFilesystem`
```typescript
interface WorkspaceFilesystem {
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

### `WorkspaceExecutor`
```typescript
interface WorkspaceExecutor {
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
}
```

### `Workspace`
```typescript
interface Workspace {
  readonly id: string;
  readonly scope: WorkspaceScope;
  readonly owner: WorkspaceOwner;
  
  // Components
  readonly fs?: WorkspaceFilesystem;
  readonly state?: WorkspaceState;
  readonly executor?: WorkspaceExecutor;
  readonly audit?: WorkspaceAudit;
  
  // Convenience methods (delegate to components)
  readFile(path: string, options?: ReadOptions): Promise<string | Buffer>;
  writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void>;
  executeCode(code: string, options?: ExecuteCodeOptions): Promise<CodeResult>;
  executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult>;
  
  // Sync (when both fs and executor present)
  syncToExecutor?(paths?: string[]): Promise<SyncResult>;
  syncFromExecutor?(paths?: string[]): Promise<SyncResult>;
  
  // Snapshots
  snapshot?(options?: SnapshotOptions): Promise<WorkspaceSnapshot>;
  restore?(snapshot: WorkspaceSnapshot, options?: RestoreOptions): Promise<void>;
  
  // Lifecycle
  init(): Promise<void>;
  destroy(): Promise<void>;
}
```

---

## Provider Implementations

### Filesystem Providers

| Provider | Persistence | Performance | Audit | Best For |
|----------|-------------|-------------|-------|----------|
| **AgentFS** | ✅ SQLite file | Medium | ✅ Full | Agent state, reproducibility |
| **LocalFS** | ✅ Disk | Fast | ❌ | Development, testing |
| **MemoryFS** | ❌ RAM only | Fastest | ❌ | Ephemeral threads |
| **S3** | ✅ Cloud | Slow | Partial | Large files, cloud native |

### Executor Providers

| Provider | Isolation | Runtimes | Cost | Best For |
|----------|-----------|----------|------|----------|
| **E2B** | ✅ VM | Python, Node | $$ | General purpose |
| **Modal** | ✅ Container | Python (GPU) | $$$ | ML, GPU workloads |
| **Docker** | ✅ Container | Any | $ | Self-hosted |
| **Daytona** | ✅ Workspace | Any | $$ | Dev environments |
| **Local** | ❌ Process | System | Free | Development only |

---

## Thread Workspace Lifecycle

```
Thread Created
     │
     ▼
┌─────────────────┐
│ Check if        │
│ workspace exists│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  Exists    Create New
    │         │
    │    ┌────┴────┐
    │    │ Init FS │
    │    │ Start   │
    │    │ Executor│
    │    └────┬────┘
    │         │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│ Workspace Ready │◄──────────────┐
└────────┬────────┘               │
         │                        │
         ▼                        │
┌─────────────────┐               │
│ Agent Execution │               │
│ (read/write/    │───────────────┘
│  execute)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Thread Inactive │
│ (timeout)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Destroy         │
│ Workspace       │
└─────────────────┘
```

---

## Package Structure

Following interface-first patterns:

```
src/
├── index.ts                    # Public exports (interfaces first)
├── filesystem/
│   ├── types.ts               # WorkspaceFilesystem interface & types
│   ├── base.ts                # BaseFilesystem abstract class
│   ├── factory.ts             # Factory functions returning interfaces
│   ├── providers/
│   │   ├── index.ts
│   │   ├── memory.ts          # MemoryFilesystem implementation
│   │   └── local.ts           # LocalFilesystem implementation
│   └── *.test.ts
├── executor/
│   ├── types.ts               # WorkspaceExecutor interface & types
│   ├── base.ts                # BaseExecutor abstract class
│   ├── factory.ts             # Factory functions returning interfaces
│   ├── providers/
│   │   ├── index.ts
│   │   └── local.ts           # LocalExecutor implementation
│   └── *.test.ts
└── workspace/
    ├── types.ts               # Workspace interface & types
    ├── workspace.ts           # BaseWorkspace + factory functions
    └── *.test.ts
```

---

## Implementation Status

### ✅ Completed

1. **Interface-First Architecture**
   - Factory functions return interface types
   - Consumers depend on contracts, not implementations
   - Base classes for provider implementers

2. **Core Interfaces & Types** (`src/*/types.ts`)
   - `WorkspaceFilesystem` interface
   - `WorkspaceExecutor` interface
   - `Workspace` interface with snapshots, sync, lifecycle
   - Configuration types for all providers
   - Custom error classes

3. **Base Classes** (`src/*/base.ts`)
   - `BaseFilesystem` - shared utilities for FS providers
   - `BaseExecutor` - shared utilities for executor providers

4. **Factory Functions** (`src/*/factory.ts`)
   - `createFilesystem()`, `createMemoryFilesystem()`, `createLocalFilesystem()`
   - `createExecutor()`, `createLocalExecutor()`
   - `createWorkspace()`, `createMemoryWorkspace()`, `createLocalWorkspace()`

5. **Memory Filesystem Provider** (`src/filesystem/providers/memory.ts`)
   - Full POSIX-like file operations
   - Directory operations
   - Initial file seeding
   - 35 passing tests

6. **Local Filesystem Provider** (`src/filesystem/providers/local.ts`)
   - Sandboxed file access
   - Path traversal protection
   - MIME type detection
   - 16 passing tests

7. **Local Executor Provider** (`src/executor/providers/local.ts`)
   - Multi-runtime support (Node, Python, Bash, etc.)
   - Code and command execution
   - Streaming output support
   - Timeout handling
   - Package installation

8. **Workspace Implementation** (`src/workspace/workspace.ts`)
   - `BaseWorkspace` class combining filesystem and executor
   - Key-value state backed by filesystem
   - Snapshot and restore
   - 21 passing tests

**Total: 72 passing tests**

### 🚧 In Progress

9. **Agent integration** - Add `workspace` config to AgentConfig
10. **Auto tool injection** - Inject workspace tools when workspace is configured
11. **Thread workspace manager** - Lifecycle management for thread workspaces

### 📋 Planned

12. **AgentFS provider** - Using `agentfs-sdk` from Turso
13. **ComputeSDK/E2B provider** - Remote sandbox execution
14. **Docker provider** - Container-based execution
15. **Sync operations** - Sync files between filesystem and executor
16. **Audit trail** - Track all workspace operations
17. **Mastra integration** - WorkspaceFactory in Mastra class

