---
'@mastra/core': minor
---

Added unified Workspace API for agent filesystem access, code execution, and search capabilities.

**New Workspace class** combines filesystem, sandbox, and search into a single interface that agents can use for file operations, command execution, and content search.

**Key features:**

- Filesystem operations (read, write, copy, move, delete) through pluggable providers
- Code and command execution through sandboxed environments with optional native OS isolation (macOS Seatbelt, Linux Bubblewrap)
- BM25 keyword search, vector semantic search, and hybrid search modes
- Skills system for discovering and using SKILL.md instruction files
- Safety controls including read-before-write guards, approval flows, and read-only mode

**Usage:**

```typescript
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';

const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
  sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
  bm25: true,
});

const agent = new Agent({
  workspace,
  // Agent automatically receives workspace tools
});
```
