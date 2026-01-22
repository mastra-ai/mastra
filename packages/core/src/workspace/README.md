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
const content = await workspace.readFile('/docs/guide.md');

// Code execution
const result = await workspace.executeCode('console.log(2 + 2)', {
  runtime: 'javascript',
});

// Search
await workspace.index('/docs/guide.md', content);
const results = await workspace.search('guide');
```

## Assigning to Agents

```typescript
import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  id: 'my-agent',
  workspace: workspace,
  // Agent automatically receives workspace tools
});
```

## Safety Configuration

```typescript
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
  sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
  safety: {
    readOnly: false, // Block all write operations
    requireReadBeforeWrite: true, // Require reading files before writing (default)
    requireSandboxApproval: 'all', // 'all' | 'commands' | 'none' (default: 'all')
    requireFilesystemApproval: 'none', // 'all' | 'write' | 'none' (default: 'none')
  },
});
```

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
- [Workspace Safety](https://mastra.ai/docs/workspace/safety)
- [Search and Indexing](https://mastra.ai/docs/workspace/search)
- [API Reference](https://mastra.ai/reference/workspace/workspace-class)
