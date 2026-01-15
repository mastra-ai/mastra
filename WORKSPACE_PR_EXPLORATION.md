# PR #11567: Agent Workspace Integration Research

## Overview

PR #11567 introduces a foundational **Workspace** abstraction for Mastra agents, providing:

- **Persistent state** and file storage
- **Auditable history** of agent actions
- **Safe, isolated code execution**

**Author**: Abhi Aiyer (@abhiaiyer91)
**Status**: Open
**Additions**: ~9,800 lines
**Key Packages**: `@mastra/core/workspace`, `@mastra/filesystem-agentfs`, `@mastra/sandbox-computesdk`

---

## Architecture

The Workspace is composed of two core abstractions:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Agent                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         Workspace                                        │ │
│  │                                                                          │ │
│  │   ┌─────────────────────────┐   ┌──────────────────────────────┐        │ │
│  │   │      Filesystem         │   │         Sandbox              │        │ │
│  │   │  (provider instance)    │   │    (provider instance)       │        │ │
│  │   │                         │   │                              │        │ │
│  │   │  • LocalFilesystem      │   │  • LocalSandbox              │        │ │
│  │   │  • AgentFilesystem      │   │  • ComputeSDKSandbox         │        │ │
│  │   │  • RamFilesystem        │   │    (E2B, Modal, etc.)        │        │ │
│  │   └─────────────────────────┘   └──────────────────────────────┘        │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. Filesystem Providers

| Provider          | Package                      | Storage      | Persistence | Best For    |
| ----------------- | ---------------------------- | ------------ | ----------- | ----------- |
| `LocalFilesystem` | `@mastra/core`               | Disk folder  | Yes         | Development |
| `RamFilesystem`   | exploration                  | Memory       | No          | Testing     |
| `AgentFilesystem` | `@mastra/filesystem-agentfs` | SQLite/Turso | Yes         | Production  |

### 2. Sandbox Providers

| Provider            | Package                      | Isolation   | Best For         |
| ------------------- | ---------------------------- | ----------- | ---------------- |
| `LocalSandbox`      | `@mastra/core`               | None (host) | Development only |
| `ComputeSDKSandbox` | `@mastra/sandbox-computesdk` | Full        | Production       |

Supported cloud providers via ComputeSDK:

- E2B, Modal, Railway, Daytona, Vercel, Runloop, Cloudflare, CodeSandbox, Blaxel

---

## Agent Integration

When you configure `workspace` on an agent, tools are **auto-injected**:

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';

const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './agent-workspace' }),
  sandbox: new LocalSandbox({ workingDirectory: './agent-workspace' }),
});

const agent = new Agent({
  id: 'code-assistant',
  model: 'openai/gpt-4',
  instructions: 'You are a helpful coding assistant.',
  workspace, // <-- Tools auto-injected!
});
```

### Auto-Injected Tools

**Filesystem tools** (when `filesystem` is configured):
| Tool | Description |
|------|-------------|
| `workspace_read_file` | Read file contents |
| `workspace_write_file` | Write content to a file |
| `workspace_list_files` | List files in a directory |
| `workspace_delete_file` | Delete a file |
| `workspace_file_exists` | Check if path exists |
| `workspace_mkdir` | Create a directory |

**Sandbox tools** (when `sandbox` is configured):
| Tool | Description |
|------|-------------|
| `workspace_execute_code` | Execute code (Node, Python, shell) |
| `workspace_execute_command` | Run shell commands |
| `workspace_install_package` | Install packages |

---

## Workspace Scoping

The PR introduces workspace scoping for different isolation levels:

```typescript
type WorkspaceScope =
  | 'global' // Shared across all agents
  | 'agent' // Shared across all threads for a single agent
  | 'thread'; // Isolated per conversation thread
```

This enables:

- **Agent-level shared workspaces** - Files persist across conversations
- **Thread-level isolated workspaces** - Each conversation has its own sandbox
- **Hybrid configurations** - Shared filesystem, isolated execution

---

## Relationship to Skills & Knowledge

### Current Skills/Knowledge Architecture

Our current work has established:

```
Skills/Knowledge Pipeline:
┌────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│    Skills      │ -> │ SkillsProcessor  │ -> │  Agent Context  │
│  (filesystem)  │    │ (input processor)│    │  (instructions) │
└────────────────┘    └──────────────────┘    └─────────────────┘
       │
       v
┌────────────────┐
│   Knowledge    │
│  (BM25 search) │
└────────────────┘
```

### Complementary Abstractions

| Concept        | Skills/Knowledge               | Workspace                         |
| -------------- | ------------------------------ | --------------------------------- |
| **Purpose**    | Static knowledge injection     | Dynamic file operations           |
| **Content**    | Instructions, references, docs | Runtime artifacts, code           |
| **Lifecycle**  | Loaded at agent init           | Created/modified during execution |
| **Mutability** | Read-only (mostly)             | Read-write                        |
| **Execution**  | No code execution              | Full code execution               |

### Integration Points

#### 1. Skills could reference Workspace files

Skills could define workspace templates or initial files:

```yaml
# SKILL.md for a data-analysis skill
name: data-analysis
description: Data analysis with Python

workspace:
  initialFiles:
    - path: /templates/analysis.py
      content: |
        import pandas as pd
        # Template for data analysis...
```

#### 2. Knowledge could index Workspace artifacts

Workspace execution results could feed back into Knowledge:

```typescript
// After agent creates files in workspace
const result = await workspace.executeCode(code, { runtime: 'python' });

// Index the output for future retrieval
await knowledge.add('workspace-artifacts', {
  type: 'text',
  key: `execution-${Date.now()}`,
  content: result.stdout,
  metadata: { type: 'execution-result', code },
});
```

#### 3. Shared Filesystem Storage

Both could use the same underlying storage abstraction:

```typescript
// Current: KnowledgeFilesystemStorage
const knowledgeStorage = new KnowledgeFilesystemStorage({
  paths: ['.mastra-knowledge/knowledge'],
});

// Workspace: LocalFilesystem / AgentFilesystem
const workspaceFs = new LocalFilesystem({
  basePath: '.mastra-workspace',
});

// Future: Unified storage?
const storage = new UnifiedAgentStorage({
  knowledge: '.mastra/knowledge',
  skills: '.mastra/skills',
  workspace: '.mastra/workspace',
});
```

---

## Key Differences from Skills/Knowledge

### 1. Tool Injection Pattern

**Skills** use input processors to inject instructions:

```typescript
// Skills: Instructions injected via processor
class SkillsProcessor implements InputProcessor {
  process(messages, context) {
    return {
      messages,
      context: { ...context, instructions: skillInstructions },
    };
  }
}
```

**Workspace** auto-injects tools directly:

```typescript
// Workspace: Tools injected on agent construction
if (config.workspace) {
  const workspaceTools = createWorkspaceTools(config.workspace);
  this.tools = { ...this.tools, ...workspaceTools };
}
```

### 2. Provider Model

**Skills/Knowledge** use a storage abstraction:

```typescript
// Single storage interface
const knowledge = new Knowledge({
  storage: new KnowledgeFilesystemStorage({ paths }),
  bm25: true,
});
```

**Workspace** uses composed providers:

```typescript
// Two separate provider interfaces
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath }), // File storage
  sandbox: new LocalSandbox({ workingDirectory }), // Code execution
});
```

### 3. Runtime vs. Design-time

- **Skills/Knowledge**: Defined at design-time, loaded at agent init
- **Workspace**: Used at runtime, modified during agent execution

---

## Potential Convergence

### Unified Agent Capabilities Model

```typescript
const agent = new Agent({
  id: 'full-featured-agent',

  // Design-time knowledge (read-mostly)
  skills: mastraSkills,
  knowledge: mastraKnowledge,

  // Runtime workspace (read-write + execution)
  workspace: new Workspace({
    filesystem: new AgentFilesystem({ id: 'agent-fs' }),
    sandbox: new ComputeSDKSandbox({ provider: 'e2b' }),
  }),
});
```

### Shared Storage Layer

A unified storage abstraction could serve all three:

```typescript
// Conceptual unified storage
interface AgentStorage {
  // Skills & Knowledge (read-mostly)
  getSkill(name: string): Skill;
  searchKnowledge(query: string): SearchResult[];

  // Workspace (read-write)
  readFile(path: string): string;
  writeFile(path: string, content: string): void;

  // Execution artifacts
  saveArtifact(key: string, content: string): void;
  getArtifact(key: string): string;
}
```

---

## Questions & Considerations

### 1. How do Skills interact with Workspace?

- Should skills be able to define initial workspace files?
- Should skill references be accessible in the workspace filesystem?
- Can skills provide workspace templates?

### 2. How does Knowledge interact with Workspace?

- Should workspace artifacts be auto-indexed in knowledge?
- Should knowledge search include workspace files?
- How to handle versioning of workspace-generated knowledge?

### 3. Storage Consolidation

- Should `KnowledgeFilesystemStorage` and `LocalFilesystem` share implementation?
- Is there value in a unified `.mastra/` directory structure?
- How to handle different persistence requirements?

### 4. Tool Injection Consistency

- Skills use input processors for context injection
- Workspace uses direct tool injection
- Should there be a unified pattern?

---

## Recommendations

### Short-term (Compatible)

1. **Keep abstractions separate** - Skills/Knowledge and Workspace serve different purposes
2. **Share storage patterns** - Use similar path resolution, debug logging
3. **Document integration patterns** - How to use skills + workspace together

### Medium-term (Integrated)

1. **Unified `.mastra/` directory**:

   ```
   .mastra/
   ├── knowledge/     # Knowledge artifacts
   ├── skills/        # Skill definitions
   └── workspace/     # Runtime workspace
   ```

2. **Cross-reference support**:
   - Skills can reference workspace paths
   - Knowledge can index workspace artifacts

### Long-term (Converged)

1. **Unified AgentStorage abstraction**
2. **Single tool injection pattern** (input processors or direct injection)
3. **Integrated versioning** across skills, knowledge, and workspace

---

## Files Changed in PR

### Core Package (`packages/core/`)

- `src/workspace/workspace.ts` - Main Workspace class
- `src/workspace/filesystem.ts` - WorkspaceFilesystem interface
- `src/workspace/sandbox.ts` - WorkspaceSandbox interface
- `src/workspace/local-filesystem.ts` - LocalFilesystem implementation
- `src/workspace/local-sandbox.ts` - LocalSandbox implementation
- `src/workspace/tools.ts` - Auto-injected workspace tools
- `src/agent/agent.ts` - Agent integration (+146 lines)
- `src/agent/types.ts` - Workspace type additions

### New Packages

- `filesystem/agentfs/` - SQLite/Turso-backed filesystem
- `sandbox/computesdk/` - ComputeSDK sandbox wrapper
- `explorations/workspace/` - Development/testing package

### Example

- `examples/workspace-code-assistant/` - Demo agent with workspace

---

## Summary

PR #11567 introduces a powerful **Workspace** abstraction that complements our Skills/Knowledge work:

| Aspect      | Skills/Knowledge         | Workspace                      |
| ----------- | ------------------------ | ------------------------------ |
| Focus       | Static context injection | Dynamic file & code operations |
| Mutability  | Read-only                | Read-write                     |
| Execution   | No                       | Yes (sandbox)                  |
| Persistence | File-based               | Provider-based (local, cloud)  |

The two systems can work together:

- **Skills** provide design-time knowledge and instructions
- **Knowledge** enables semantic search over documents
- **Workspace** enables runtime file operations and code execution

This creates a complete agent capability model for building sophisticated AI agents.
