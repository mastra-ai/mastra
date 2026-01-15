# Unified Workspace Design

The overall vision and architecture for Mastra's unified Workspace primitive.

---

## Goal

**Create a single, unified Workspace primitive** that provides agents with:

- **File storage** - Read, write, and organize files
- **Code execution** - Run code in sandboxed environments
- **Search** - Find content using keyword (BM25), semantic (vector), or hybrid search
- **Skills** - Discover and use SKILL.md files from configurable paths

This replaces the current fragmented approach of separate Knowledge, Skills, and Workspace concepts.

---

## Why Unify?

### Current State (Three Concepts)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Knowledge    │    │     Skills      │    │    Workspace    │
│                 │    │                 │    │                 │
│ • Storage       │    │ • SKILL.md      │    │ • Filesystem    │
│ • BM25 search   │    │ • Discovery     │    │ • Sandbox       │
│ • Vector search │    │ • Search        │    │ • Code exec     │
│ • Namespaces    │    │ • References    │    │ • Tools         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Problems:**

- Three separate primitives to configure and understand
- Overlapping storage concepts (Knowledge storage vs Workspace filesystem)
- Separate search implementations
- Skills artificially separated from the files they represent

### Target State (One Concept)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Workspace                                │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Filesystem                                  │   │
│   │  • readFile, writeFile, readdir, exists, mkdir, delete  │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Sandbox (optional)                          │   │
│   │  • executeCode, executeCommand, installPackage          │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Search (optional)                           │   │
│   │  • BM25 keyword search                                  │   │
│   │  • Vector semantic search                               │   │
│   │  • Hybrid search                                        │   │
│   │  • index(), search()                                    │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Skills (configurable paths)                 │   │
│   │  • SKILL.md parsing from skillsPaths                    │   │
│   │  • listSkills, getSkill, searchSkills                   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits:**

- **Simpler mental model** - One primitive to learn
- **Unified storage** - Single filesystem abstraction for everything
- **Composable** - Enable only what you need (filesystem only, +search, +sandbox)
- **Consistent** - Same patterns as other Mastra abstractions (stores/, vectors/)
- **Flexible** - Multiple filesystem providers (local, cloud, in-memory)

---

## Core Design Principles

### 1. Workspace = Everything

All file-based functionality goes through Workspace:

- Files live in `workspace.filesystem`
- Search indexes content from the filesystem
- Skills are SKILL.md files in the filesystem at configured paths
- Code execution happens in `workspace.sandbox`

### 2. Skills = Directory Convention

Skills are not a separate primitive. They are a **directory pattern** within Workspace:

- Workspace scans `skillsPaths` (default: `['/skills']`) for SKILL.md files
- Skill parsing, discovery, and search use workspace capabilities
- Users can configure where skills live: `['/skills']`, `['/prompts', '/custom']`, etc.

### 3. Processors Handle Context

Workspace stores and searches. **Processors decide what to inject into agent context:**

| Workspace Does         | Processors Do                      |
| ---------------------- | ---------------------------------- |
| Store files            | Inject static content into context |
| Search indexed content | Search and inject relevant docs    |
| Parse SKILL.md files   | Match and activate skills          |

This separation keeps Workspace focused while processors handle agent-specific logic.

### 4. Provider-Based Architecture

Workspace uses provider instances for flexibility:

```typescript
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './data' }), // Provider
  sandbox: new E2BSandbox({ apiKey: '...' }), // Provider
  vectorStore: pinecone, // Provider
});
```

This allows mixing providers: local filesystem with cloud sandbox, or cloud filesystem with no sandbox.

---

## Workspace Scoping

Workspaces support three scopes for access control:

```typescript
type WorkspaceScope = 'global' | 'agent' | 'thread';
```

| Scope    | Shared Across             | Use Case                         |
| -------- | ------------------------- | -------------------------------- |
| `global` | All agents, all threads   | Shared skills, company knowledge |
| `agent`  | All threads for one agent | Agent-specific skills and data   |
| `thread` | Single conversation       | Thread-specific working files    |

### Example: Multi-Scope Setup

```typescript
const mastra = new Mastra({
  // Global workspace - company-wide skills and docs
  workspace: new Workspace({
    scope: 'global',
    filesystem: new AgentFS({
      /* ... */
    }),
    skillsPaths: ['/skills'],
    bm25: true,
  }),

  agents: {
    supportAgent: new Agent({
      id: 'support',
      // Inherits global workspace
    }),

    developerAgent: new Agent({
      id: 'developer',
      // Has its own agent-scoped workspace for dev-specific skills
      workspace: new Workspace({
        scope: 'agent',
        agentId: 'developer',
        filesystem: new LocalFilesystem({ basePath: './.mastra/agents/developer' }),
        skillsPaths: ['/skills'],
      }),
    }),
  },
});
```

### Skill Resolution Order

When an agent needs skills, resolution follows the scope hierarchy:

1. **Thread workspace** (most specific)
2. **Agent workspace** (agent-specific)
3. **Global workspace** (shared)

---

## API Overview

### WorkspaceConfig

```typescript
interface WorkspaceConfig {
  // Identity & Scoping
  id?: string;
  scope?: WorkspaceScope;
  agentId?: string;
  threadId?: string;

  // Core Providers
  filesystem: WorkspaceFilesystem;
  sandbox?: WorkspaceSandbox;

  // Search Capabilities
  vectorStore?: VectorStore;
  embedder?: Embedder;
  bm25?: boolean | BM25Config;

  // Directory Conventions
  skillsPaths?: string[]; // Default: ['/skills']
  autoIndexPaths?: string[]; // Paths to index on init()
}
```

### Workspace API

```typescript
class Workspace {
  // === File Operations ===
  readFile(path: string): Promise<string | Buffer>;
  writeFile(path: string, content: string | Buffer): Promise<void>;
  readdir(path: string): Promise<FileEntry[]>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  deleteFile(path: string): Promise<void>;

  // === Code Execution (if sandbox configured) ===
  executeCode(code: string, options?: ExecuteCodeOptions): Promise<CodeResult>;
  executeCommand(command: string, args?: string[]): Promise<CommandResult>;

  // === Search (if bm25 or vectorStore configured) ===
  index(path: string, content: string, options?: IndexOptions): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  rebuildIndex(paths?: string[]): Promise<void>;

  // === Skills (nested accessor, if skillsPaths configured) ===
  skills: WorkspaceSkills;

  // === Capabilities ===
  canBM25: boolean;
  canVector: boolean;
  canHybrid: boolean;
}

// Skills accessed via workspace.skills
interface WorkspaceSkills {
  list(): Promise<SkillMetadata[]>;
  get(name: string): Promise<Skill | null>;
  has(name: string): Promise<boolean>;
  search(query: string, options?: SkillSearchOptions): Promise<SkillSearchResult[]>;

  create(input: CreateSkillInput): Promise<Skill>;
  update(name: string, input: UpdateSkillInput): Promise<Skill>;
  delete(name: string): Promise<void>;

  getReference(skillName: string, path: string): Promise<string | null>;
  getScript(skillName: string, path: string): Promise<string | null>;
  getAsset(skillName: string, path: string): Promise<Buffer | null>;
}
```

### SearchOptions

```typescript
interface SearchOptions {
  topK?: number;
  minScore?: number;
  mode?: 'bm25' | 'vector' | 'hybrid';
  vectorWeight?: number; // For hybrid mode (0-1)
  paths?: string[]; // Scope search to paths
  filter?: Record<string, unknown>; // Vector filter
}
```

### SearchResult

```typescript
interface SearchResult {
  id: string; // File path
  content: string; // Matched content
  score: number; // Search score
  lineRange?: LineRange; // Where match was found
  metadata?: Record<string, unknown>;
  scoreDetails?: {
    vector?: number;
    bm25?: number;
  };
}
```

---

## Tool Injection

When workspace is configured on an agent, tools are auto-injected:

| Tool                        | When Available         | Description            |
| --------------------------- | ---------------------- | ---------------------- |
| `workspace_read_file`       | Always (if filesystem) | Read file contents     |
| `workspace_write_file`      | Always (if filesystem) | Write to a file        |
| `workspace_list_files`      | Always (if filesystem) | List directory         |
| `workspace_search`          | If search configured   | Search indexed content |
| `workspace_execute_code`    | If sandbox configured  | Run code               |
| `workspace_execute_command` | If sandbox configured  | Run shell command      |

---

## Workspace Providers

Multiple filesystem and sandbox implementations available:

### Filesystem Providers

| Provider          | Package                      | Storage      | Best For        |
| ----------------- | ---------------------------- | ------------ | --------------- |
| `LocalFilesystem` | `@mastra/core`               | Disk         | Development     |
| `AgentFS`         | `@mastra/filesystem-agentfs` | SQLite/Turso | Production      |
| `RamFilesystem`   | `@mastra/core`               | Memory       | Testing         |
| `E2BFilesystem`   | `@mastra/filesystem-e2b`     | E2B Cloud    | Cloud sandboxes |

### Sandbox Providers

| Provider            | Package                      | Isolation | Best For         |
| ------------------- | ---------------------------- | --------- | ---------------- |
| `LocalSandbox`      | `@mastra/core`               | None      | Development only |
| `ComputeSDKSandbox` | `@mastra/sandbox-computesdk` | Full      | Production       |
| `E2BSandbox`        | `@mastra/sandbox-e2b`        | Full      | E2B users        |

### Example Configurations

```typescript
// Development: Local files, no sandbox
const devWorkspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
  bm25: true,
});

// Production: Cloud storage with search
const prodWorkspace = new Workspace({
  filesystem: new AgentFS({
    connectionUrl: process.env.TURSO_URL,
    authToken: process.env.TURSO_TOKEN,
  }),
  vectorStore: pinecone,
  embedder: openaiEmbed,
  bm25: true,
});

// Full sandbox: E2B for code execution
const sandboxWorkspace = new Workspace({
  filesystem: new E2BFilesystem({ sandboxId: 'xxx' }),
  sandbox: new E2BSandbox({ sandboxId: 'xxx' }),
});
```

---

## Related Documents

For migration-specific details, see:

- [KNOWLEDGE_MIGRATION_PLAN.md](./KNOWLEDGE_MIGRATION_PLAN.md) - How Knowledge becomes Workspace
- [SKILLS_MIGRATION_PLAN.md](./SKILLS_MIGRATION_PLAN.md) - How Skills integrates with Workspace

For background research:

- [WORKSPACE_PR_EXPLORATION.md](./WORKSPACE_PR_EXPLORATION.md) - PR #11567 analysis
- [AGENT_SKILLS_SPEC.md](./AGENT_SKILLS_SPEC.md) - Agent Skills specification
