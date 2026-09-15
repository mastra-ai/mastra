# Workspace

The Workspace module provides agents with filesystem access and code execution capabilities through a unified interface.

## Features

- **Filesystem access** - Read, write, and manage files through pluggable filesystem providers
- **Code execution** - Run code and shell commands through sandboxed environments
- **Search** - BM25 keyword search, vector semantic search, and hybrid search
- **Skills** - Discover and use SKILL.md files for reusable instructions
- **Safety controls** - Read-before-write guards, approval flows, and read-only mode

## Quick Start

```typescript
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';

const workspace = new Workspace({
  filesystem: new LocalFilesystem({
    basePath: './workspace',
  }),
  sandbox: new LocalSandbox({
    workingDirectory: './workspace',
  }),
  bm25: true,
});

await workspace.init();

// File operations
await workspace.writeFile('/docs/guide.md', '# Guide');
const content = await workspace.readFile('/docs/guide.md', { encoding: 'utf-8' });

// Command execution
const result = await workspace.executeCommand('echo', ['hello world']);

// Search
await workspace.index('/docs/guide.md', content as string);
const results = await workspace.search('guide');
```

## Assigning to Agents

```typescript
import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  id: 'my-agent',
  workspace: workspace,
  // Agent receives workspace tools when a workspace is provided
});
```

## Safety Configuration

```typescript
const workspace = new Workspace({
  filesystem: new LocalFilesystem({
    basePath: './workspace',
    readOnly: true, // Block all write operations (default: false)
  }),
  sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
  tools: {
    // Top-level defaults for all tools
    requireApproval: true,
    // Per-tool overrides
    mastra_workspace_write_file: {
      requireReadBeforeWrite: true, // Require reading files before writing
    },
    mastra_workspace_execute_command: {
      requireApproval: true,
    },
  },
});
```

### Persisting read-before-write across suspend/resume

By default `requireReadBeforeWrite` is tracked by an in-process tracker that is
created fresh for each run. If a run suspends between a read and a write (plan
approval, `requireApproval` tools, `askUserTool`) — especially on serverless or
container runtimes that tear the process down while waiting for a human — the
tracker is discarded and recreated empty on resume, so the first write is
rejected with "has not been read".

Inject a persistent, per-thread `fileReadTracker` (as an instance, or a factory
that receives `{ threadId, resourceId, runId, requestContext }`) so read records
survive suspend/resume:

```typescript
const trackers = new Map<string, FileReadTracker>();

const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
  tools: {
    mastra_workspace_edit_file: { requireReadBeforeWrite: true },
  },
  // Return a tracker scoped (and persisted) per thread. Back it with your own
  // storage to survive process restarts; an in-memory Map is shown for brevity.
  fileReadTracker: ({ threadId }) => {
    const key = threadId ?? 'default';
    let tracker = trackers.get(key);
    if (!tracker) {
      tracker = new InMemoryFileReadTracker();
      trackers.set(key, tracker);
    }
    return tracker;
  },
});
```

Tracker methods may be synchronous or return promises, so a storage-backed
implementation can be fully asynchronous.

## Module Structure

- `workspace.ts` - Main Workspace class
- `filesystem.ts` - WorkspaceFilesystem interface and types
- `local-filesystem.ts` - LocalFilesystem implementation
- `sandbox.ts` - WorkspaceSandbox interface and types
- `local-sandbox.ts` - LocalSandbox implementation
- `tools.ts` - Workspace tool generation for agents
- `search-engine.ts` - BM25 and vector search
- `bm25.ts` - BM25 algorithm implementation
- `skills/` - Skills system for SKILL.md files
- `file-read-tracker.ts` - Read-before-write tracking
- `line-utils.ts` - Line number utilities for search results

## Documentation

- [Workspace Overview](https://mastra.ai/docs/workspace/overview)
- [Filesystem](https://mastra.ai/docs/workspace/filesystem)
- [Sandbox](https://mastra.ai/docs/workspace/sandbox)
- [Search and Indexing](https://mastra.ai/docs/workspace/search)
- [Skills](https://mastra.ai/docs/workspace/skills)
- [API Reference](https://mastra.ai/reference/workspace/workspace-class)
