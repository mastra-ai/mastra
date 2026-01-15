# Unified Workspace Design

Merging Knowledge and Workspace into a single unified primitive.

## Core Idea

**Workspace = Knowledge + Workspace merged.** All capabilities from both primitives become Workspace. Skills is a specialized directory convention within Workspace.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Workspace                                │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Filesystem (from Workspace)                 │   │
│   │  • readFile, writeFile, readdir, exists, mkdir, delete  │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Sandbox (from Workspace) - optional         │   │
│   │  • executeCode, executeCommand, installPackage          │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Search (from Knowledge) - optional          │   │
│   │  • BM25 keyword search                                  │   │
│   │  • Vector semantic search                               │   │
│   │  • Hybrid search                                        │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              /skills (directory convention)              │   │
│   │  • SKILL.md parsing                                     │   │
│   │  • Skill matching & resolution                          │   │
│   │  • listSkills, getSkill, searchSkills                   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Decisions

### 1. Workspace = Knowledge + Workspace Merged

The two primitives become one:

| From Knowledge      | From Workspace         | Result                      |
| ------------------- | ---------------------- | --------------------------- |
| Storage abstraction | Filesystem abstraction | **Workspace.filesystem**    |
| BM25 search         | -                      | **Workspace.search()**      |
| Vector search       | -                      | **Workspace.search()**      |
| Hybrid search       | -                      | **Workspace.search()**      |
| -                   | Sandbox                | **Workspace.sandbox**       |
| -                   | executeCode/Command    | **Workspace.executeCode()** |
| -                   | Auto-injected tools    | **createWorkspaceTools()**  |

### 2. Skills = Directory Convention

Skills is not a separate primitive - it's a `/skills` directory pattern within Workspace:

- Workspace scans `/skills` for SKILL.md files
- Skill matching uses workspace search capabilities
- `listSkills()`, `getSkill()`, `searchSkills()` are Workspace methods

### 3. Knowledge Class Goes Away

The `Knowledge` class is removed. Its functionality moves to Workspace:

- `knowledge.add()` → `workspace.writeFile()`
- `knowledge.get()` → `workspace.readFile()`
- `knowledge.search()` → `workspace.search()`
- `knowledge.listNamespaces()` → `workspace.readdir()` + scoping

### 4. Workspace Lives on Mastra Instance

```typescript
const mastra = new Mastra({
  workspace: new Workspace({
    filesystem: new AgentFS({
      /* ... */
    }),
    vectorStore: pinecone, // Optional, for semantic search
    bm25: true, // Optional, for keyword search
  }),
  agents: { developerAgent, supportAgent },
});
```

### 5. No Backward Compatibility Concerns

None of this is merged to main yet - greenfield development.

---

## Workspace Scoping

Workspaces support three scopes. Skills and all content follow the same pattern.

```typescript
type WorkspaceScope = 'global' | 'agent' | 'thread';
```

| Scope    | Shared Across             | Use Case                            |
| -------- | ------------------------- | ----------------------------------- |
| `global` | All agents, all threads   | Shared skills, company knowledge    |
| `agent`  | All threads for one agent | Agent-specific skills, agent memory |
| `thread` | Single conversation       | Thread-specific work files          |

### Directory Structure with Scopes

```
.mastra/
├── global/                    # scope: 'global'
│   ├── skills/                # Available to ALL agents
│   │   ├── code-review/
│   │   └── api-design/
│   └── knowledge/             # Shared knowledge
│
├── agents/
│   ├── docs-agent/            # scope: 'agent', agentId: 'docs-agent'
│   │   ├── skills/            # Only for docs-agent
│   │   │   └── brand-guidelines/
│   │   └── knowledge/         # Agent-specific knowledge
│   │
│   └── developer-agent/       # scope: 'agent', agentId: 'developer-agent'
│       ├── skills/
│       └── knowledge/
│
└── threads/                   # scope: 'thread'
    └── {threadId}/
        └── work/              # Thread-specific runtime files
```

### Mastra + Agent Configuration

```typescript
const mastra = new Mastra({
  // Global workspace - shared skills/knowledge
  workspace: new Workspace({
    scope: 'global',
    filesystem: new AgentFS({
      /* ... */
    }),
  }),

  agents: {
    docsAgent: new Agent({
      id: 'docs-agent',
      // Agent can have its own scoped workspace
      workspace: new Workspace({
        scope: 'agent',
        agentId: 'docs-agent',
        filesystem: new LocalFilesystem({ basePath: './.mastra/agents/docs-agent' }),
      }),
    }),

    developerAgent: new Agent({
      id: 'developer-agent',
      // No workspace = inherits from Mastra global
    }),
  },
});
```

### Skill Resolution Order

When an agent needs skills:

1. **Thread workspace** (if exists) - most specific
2. **Agent workspace** (if exists) - agent-specific skills
3. **Global workspace** (Mastra-level) - shared skills

```typescript
// Agent.getSkills() resolves from all applicable workspaces
const allSkills = [
  ...(threadWorkspace?.listSkills() ?? []),
  ...(agentWorkspace?.listSkills() ?? []),
  ...(globalWorkspace?.listSkills() ?? []),
];
```

---

## Workspace Implementations

Structure mirrors `stores/` - multiple implementations:

```
workspaces/
├── local/           # LocalFilesystem (disk-based)
├── agentfs/         # AgentFS (SQLite/Turso)
├── daytona/         # Daytona cloud workspace
├── e2b/             # E2B sandbox + filesystem
└── memory/          # In-memory (testing)
```

### Examples

```typescript
// Local disk-based
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
});

// SQLite/Turso-backed
const workspace = new Workspace({
  filesystem: new AgentFS({
    connectionUrl: process.env.TURSO_URL,
    authToken: process.env.TURSO_TOKEN,
  }),
});

// Daytona cloud with sandbox
const workspace = new Workspace({
  filesystem: new DaytonaFilesystem({ projectId: 'my-project' }),
  sandbox: new DaytonaSandbox({ projectId: 'my-project' }),
});

// E2B with integrated sandbox
const workspace = new Workspace({
  filesystem: new E2BFilesystem({ sandboxId: 'xxx' }),
  sandbox: new E2BSandbox({ sandboxId: 'xxx' }),
});
```

---

## API Design

### WorkspaceConfig

```typescript
interface WorkspaceConfig {
  id?: string;
  scope?: WorkspaceScope;
  agentId?: string; // Required if scope is 'agent'
  threadId?: string; // Required if scope is 'thread'

  // Core providers
  filesystem: WorkspaceFilesystem;
  sandbox?: WorkspaceSandbox;

  // Search capabilities (from Knowledge)
  vectorStore?: VectorStore; // Or inherit from Mastra
  embedder?: Embedder; // Required if vectorStore is provided
  bm25?: boolean | BM25Config;

  // Directory conventions
  skillsPath?: string; // Default: '/skills'
}
```

### Workspace Class (Complete Merged API)

```typescript
class Workspace {
  // === Providers ===
  readonly filesystem: WorkspaceFilesystem;
  readonly sandbox?: WorkspaceSandbox;

  // === Filesystem Operations (from current Workspace) ===
  readFile(path: string, options?: ReadOptions): Promise<string | Buffer>;
  writeFile(path: string, content: string | Buffer, options?: WriteOptions): Promise<void>;
  readdir(path: string, options?: ReaddirOptions): Promise<FileEntry[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: MkdirOptions): Promise<void>;
  deleteFile(path: string, options?: DeleteOptions): Promise<void>;
  stat(path: string): Promise<FileStat>;
  copyFile(src: string, dest: string): Promise<void>;
  moveFile(src: string, dest: string): Promise<void>;

  // === Sandbox Operations (from current Workspace) ===
  executeCode(code: string, options?: ExecuteOptions): Promise<CodeResult>;
  executeCommand(command: string, args?: string[], options?: CommandOptions): Promise<CommandResult>;
  installPackage?(packageName: string, options?: InstallOptions): Promise<InstallResult>;

  // === Search Operations (from Knowledge) ===
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  index(path: string, options?: IndexOptions): Promise<void>; // Index a file for search
  indexDirectory(path: string, options?: IndexDirOptions): Promise<void>; // Index all files in directory

  // Search capabilities
  get canBM25(): boolean;
  get canVector(): boolean;
  get canHybrid(): boolean;

  // === Skills Operations (directory convention) ===
  listSkills(): Promise<SkillMetadata[]>;
  getSkill(name: string): Promise<Skill | null>;
  searchSkills(query: string, options?: SearchOptions): Promise<SkillSearchResult[]>;

  // === Scoping ===
  readonly scope: WorkspaceScope;
  readonly agentId?: string;
  readonly threadId?: string;
}

// Search options (from Knowledge)
interface SearchOptions {
  topK?: number;
  minScore?: number;
  mode?: 'bm25' | 'vector' | 'hybrid';
  filter?: Record<string, unknown>;
  path?: string; // Scope search to a specific directory
}
```

---

## Tool Injection vs Input Processing

Two patterns for giving agents capabilities. **Use both.**

### Pattern 1: Tool Injection

Tools added directly to agent's tool set. Agent decides when to use.

```typescript
function createWorkspaceTools(workspace: Workspace) {
  return {
    workspace_read_file: createTool({
      /* ... */
    }),
    workspace_write_file: createTool({
      /* ... */
    }),
    workspace_execute_code: createTool({
      /* ... */
    }),
    workspace_search: createTool({
      /* ... */
    }),
  };
}
```

**Best for**: File operations, code execution, explicit search

### Pattern 2: Input Processing

Processors inject context/tools based on content matching.

```typescript
class SkillsProcessor implements InputProcessor {
  async process(messages, context) {
    const activeSkills = await this.matchSkills(messages);
    return {
      messages,
      context: {
        ...context,
        instructions: context.instructions + '\n' + skillInstructions,
      },
    };
  }
}
```

**Best for**: Skill instructions, contextual knowledge injection

### Recommendation

| Capability           | Pattern          | Rationale                     |
| -------------------- | ---------------- | ----------------------------- |
| File operations      | Tool injection   | Agent explicitly reads/writes |
| Code execution       | Tool injection   | Agent decides when to run     |
| Search               | Tool injection   | Agent explicitly searches     |
| Skill instructions   | Input processing | Context injected when matched |
| Contextual knowledge | Input processing | Relevant docs auto-injected   |

---

## Search Index Architecture

### BM25 Index

The existing `BM25Index` class is designed for persistence:

```typescript
// Serialization support already exists
interface BM25IndexData {
  k1: number;
  b: number;
  documents: SerializedBM25Document[];
  avgDocLength: number;
}

// BM25Index methods
bm25Index.serialize(): BM25IndexData;           // Export to JSON
BM25Index.deserialize(data): BM25Index;         // Restore from JSON
```

**Decision: Memory-only with optional persistence**

Default behavior (recommended):

- BM25 index lives in memory
- Rebuilt on startup from `/knowledge` directory files
- Fast enough for typical knowledge bases (< 10k documents)

For large datasets, optional persistence:

```typescript
// On shutdown or periodically
const indexData = workspace.bm25Index.serialize();
await workspace.writeFile('/.indexes/bm25.json', JSON.stringify(indexData));

// On startup
const cached = await workspace.readFile('/.indexes/bm25.json');
const bm25Index = BM25Index.deserialize(JSON.parse(cached));
```

If using AgentFS (SQLite/Turso), index can be stored in a dedicated table instead of filesystem.

### Vector Indexes

**Decision: Configure on workspace OR inherit from Mastra**

```typescript
// Option A: Workspace has its own vectorStore
const workspace = new Workspace({
  filesystem: new AgentFS({
    /* ... */
  }),
  vectorStore: new PineconeStore({
    /* ... */
  }),
});

// Option B: Inherit from Mastra (recommended for shared vector stores)
const mastra = new Mastra({
  vectors: {
    pinecone: new PineconeStore({
      /* ... */
    }),
  },
  workspace: new Workspace({
    filesystem: new AgentFS({
      /* ... */
    }),
    // vectorStore inherited from mastra.vectors.pinecone
  }),
});
```

Vector indexes are managed by the vector store provider (Pinecone, Chroma, etc.) - workspace just references them.

---

## Benefits

1. **Simpler Mental Model**: One primitive instead of three
2. **Unified Storage**: Single filesystem abstraction
3. **Composable**: Mix and match filesystem + sandbox + search
4. **Consistent Patterns**: Similar to stores/ architecture
5. **Scope-Based Access**: Skills/knowledge scoped like workspace

---

## Current Implementation Catalogue

### packages/core (Interfaces & Base Classes)

| File                          | Contents                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/knowledge/types.ts`      | `MastraKnowledge` interface, `KnowledgeSearchResult`, `KnowledgeSearchOptions`, artifact types    |
| `src/knowledge/base.ts`       | `KnowledgeStorage` abstract class (namespace CRUD, artifact CRUD)                                 |
| `src/skills/types.ts`         | `MastraSkills` interface, `Skill`, `SkillMetadata`, `SkillSearchResult`, skill CRUD types         |
| `src/skills/base.ts`          | `SkillsStorage` abstract class (skill discovery, CRUD, references/scripts/assets)                 |
| `src/artifacts/types.ts`      | Shared types: `ContentSource`, `SearchMode`, `LineRange`, `BaseSearchResult`, `BaseSearchOptions` |
| `src/workspace/workspace.ts`  | `Workspace` class (filesystem + sandbox), lifecycle, sync, snapshots                              |
| `src/workspace/filesystem.ts` | `WorkspaceFilesystem` interface                                                                   |
| `src/workspace/sandbox.ts`    | `WorkspaceSandbox` interface                                                                      |
| `src/workspace/tools.ts`      | `createWorkspaceTools()` - auto-injected tools for agents                                         |
| `src/workspace/local-*.ts`    | `LocalFilesystem`, `LocalSandbox` implementations                                                 |

### packages/skills (Implementations)

| File                                    | Contents                                                                |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `src/skills.ts`                         | `Skills` class - full implementation with BM25/vector search            |
| `src/knowledge.ts`                      | `Knowledge` class - namespace/artifact management with search           |
| `src/search-engine.ts`                  | `SearchEngine` class - unified BM25 + vector + hybrid search            |
| `src/bm25.ts`                           | `BM25Index` class - in-memory inverted index with serialize/deserialize |
| `src/storage/filesystem.ts`             | `FilesystemStorage` - skills storage on disk                            |
| `src/storage/knowledge-filesystem.ts`   | `KnowledgeFilesystemStorage` - knowledge storage on disk                |
| `src/processors/skills.ts`              | `SkillsProcessor` - input processor for skill activation/tools          |
| `src/processors/static-knowledge.ts`    | `StaticKnowledge` - processor for static artifacts                      |
| `src/processors/retrieved-knowledge.ts` | `RetrievedKnowledge` - processor for search-based injection             |
| `src/schemas.ts`                        | Zod schemas for skill validation                                        |

### What Moves Where

| Current Location                                | Destination              | Notes                          |
| ----------------------------------------------- | ------------------------ | ------------------------------ |
| `@mastra/skills/search-engine`                  | `@mastra/core/workspace` | Core search capability         |
| `@mastra/skills/bm25`                           | `@mastra/core/workspace` | BM25 index implementation      |
| `@mastra/core/knowledge/*`                      | **REMOVED**              | Subsumed by Workspace          |
| `@mastra/skills/knowledge`                      | **REMOVED**              | Subsumed by Workspace          |
| `@mastra/skills/storage/knowledge-*`            | **REMOVED**              | Use Workspace filesystem       |
| `@mastra/skills/processors/static-knowledge`    | Keep or adapt            | May become workspace processor |
| `@mastra/skills/processors/retrieved-knowledge` | Keep or adapt            | May become workspace processor |

---

## Implementation Plan

### Phase 1: Add Search to Workspace

1. [ ] Add `SearchEngine` to Workspace class (from Knowledge)
2. [ ] Add `search()`, `index()`, `indexDirectory()` methods
3. [ ] Add `bm25` and `vectorStore` config options
4. [ ] Add `workspace_search` tool to `createWorkspaceTools()`

### Phase 2: Add Skills to Workspace

1. [ ] Add `listSkills()`, `getSkill()`, `searchSkills()` methods
2. [ ] Implement SKILL.md parsing within Workspace
3. [ ] Skills indexed in workspace search automatically

### Phase 3: Deprecate Knowledge

1. [ ] Mark Knowledge class as deprecated
2. [ ] Migration guide: Knowledge → Workspace
3. [ ] Remove Knowledge from examples

### Phase 4: Scope-based Resolution

1. [ ] Test global/agent/thread scoping
2. [ ] Skill resolution across scopes
3. [ ] Search across scopes (optional)

---

## Related Documents

- [WORKSPACE_PR_EXPLORATION.md](./WORKSPACE_PR_EXPLORATION.md) - PR #11567 research
- [AGENT_SKILLS_SPEC.md](./AGENT_SKILLS_SPEC.md) - Agent Skills spec (agentskills.io)
- [SKILLS_GRAPHS.md](./SKILLS_GRAPHS.md) - Knowledge graph exploration
- [VERSIONING_DESIGN.md](./VERSIONING_DESIGN.md) - Skill versioning design
