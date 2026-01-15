# Knowledge Migration Plan

This document outlines the migration of Knowledge functionality into the unified Workspace primitive in `@mastra/core/workspace`.

**Status**: In Progress

---

## Current Knowledge Implementation

### Location

`packages/skills/src/knowledge.ts` (primary)
`packages/skills/src/search-engine.ts` (search)
`packages/skills/src/bm25.ts` (BM25 index)

### Core Features

| Feature                  | Description                    | File               |
| ------------------------ | ------------------------------ | ------------------ |
| **Namespace Management** | Organize content by namespace  | `knowledge.ts`     |
| **BM25 Search**          | Keyword-based search           | `bm25.ts`          |
| **Vector Search**        | Semantic search via embeddings | `search-engine.ts` |
| **Hybrid Search**        | Combined BM25 + vector         | `search-engine.ts` |
| **Static Content**       | Non-indexed content injection  | `knowledge.ts`     |
| **Artifact Storage**     | Store content with metadata    | `knowledge.ts`     |

### Knowledge Class API

```typescript
class Knowledge {
  // Core operations
  add(namespace: string, artifact: Artifact): Promise<void>;
  get(namespace: string, key: string): Promise<Artifact | null>;
  delete(namespace: string, key: string): Promise<boolean>;
  list(namespace: string): Promise<string[]>;

  // Search
  search(namespace: string, query: string, options?: SearchOptions): Promise<SearchResult[]>;

  // Static content
  getStatic(namespace: string): Promise<Artifact[]>;

  // Namespaces
  createNamespace(name: string): Promise<void>;
  listNamespaces(): Promise<string[]>;
}
```

### SearchEngine Class API

```typescript
class SearchEngine {
  // Indexing
  index(doc: IndexDocument): Promise<void>;
  indexMany(docs: IndexDocument[]): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): void;

  // Search
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  // Capabilities
  canBM25: boolean;
  canVector: boolean;
  canHybrid: boolean;

  // Access to underlying BM25 index
  bm25Index?: BM25Index;
}
```

### BM25Index Class API

```typescript
class BM25Index {
  // Document management
  add(id: string, content: string, metadata?: Record<string, unknown>): void;
  remove(id: string): boolean;
  clear(): void;
  get(id: string): BM25Document | undefined;
  has(id: string): boolean;

  // Search
  search(query: string, topK?: number, minScore?: number): BM25SearchResult[];

  // Persistence
  serialize(): BM25IndexData;
  static deserialize(data: BM25IndexData, tokenizeOptions?: TokenizeOptions): BM25Index;

  // Properties
  size: number;
  documentIds: string[];
}
```

---

## Migration Strategy

### What Moves to `@mastra/core/workspace`

| Component      | Source                        | Destination                           |
| -------------- | ----------------------------- | ------------------------------------- |
| `BM25Index`    | `skills/src/bm25.ts`          | `core/src/workspace/bm25.ts`          |
| `SearchEngine` | `skills/src/search-engine.ts` | `core/src/workspace/search-engine.ts` |
| Search types   | `skills/src/search-engine.ts` | `core/src/workspace/search-engine.ts` |
| Tokenization   | `skills/src/bm25.ts`          | `core/src/workspace/bm25.ts`          |

### What Gets Removed

| Component                    | Reason                               |
| ---------------------------- | ------------------------------------ |
| `Knowledge` class            | Replaced by Workspace with search    |
| Namespace concept            | Paths replace namespaces             |
| Static content mgmt          | Handled by processors                |
| `KnowledgeFilesystemStorage` | Workspace filesystem handles storage |

### What Changes

| Before                               | After                                |
| ------------------------------------ | ------------------------------------ |
| `knowledge.add(namespace, artifact)` | `workspace.index(path, content)`     |
| `knowledge.search(namespace, query)` | `workspace.search(query, { paths })` |
| `knowledge.getStatic(namespace)`     | Processor handles this               |
| Namespace-based organization         | Path-based organization              |
| Separate Knowledge instance          | Integrated into Workspace            |

---

## New Workspace Search API

### Configuration

```typescript
interface WorkspaceConfig {
  // ... existing config

  /** Vector store for semantic search */
  vectorStore?: MastraVector;

  /** Embedder function for vector search */
  embedder?: Embedder;

  /** Enable BM25 search */
  bm25?: boolean | BM25Config;

  /** Paths to auto-index on init */
  autoIndexPaths?: string[];

  /** Paths where skills are located */
  skillsPaths?: string[];
}
```

### Search Methods on Workspace

```typescript
class Workspace {
  // ... existing methods

  /**
   * Index content for search.
   * Path becomes the document ID for search results.
   */
  index(path: string, content: string, options?: IndexOptions): Promise<void>;

  /**
   * Index multiple documents
   */
  indexMany(docs: Array<{ path: string; content: string; options?: IndexOptions }>): Promise<void>;

  /**
   * Remove a document from the search index
   */
  unindex(path: string): Promise<void>;

  /**
   * Search indexed content
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Rebuild BM25 index from filesystem paths
   */
  rebuildIndex(paths?: string[]): Promise<void>;

  // Capabilities
  canBM25: boolean;
  canVector: boolean;
  canHybrid: boolean;
}
```

### IndexOptions

```typescript
interface IndexOptions {
  /** Content type hint */
  type?: 'text' | 'image' | 'file';
  /** MIME type for the content */
  mimeType?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Starting line offset for chunked content */
  startLineOffset?: number;
}
```

### SearchOptions

```typescript
interface SearchOptions {
  /** Maximum results to return */
  topK?: number;
  /** Minimum score threshold */
  minScore?: number;
  /** Search mode: 'bm25', 'vector', or 'hybrid' */
  mode?: 'bm25' | 'vector' | 'hybrid';
  /** Weight for vector scores in hybrid (0-1) */
  vectorWeight?: number;
  /** Only search within these paths */
  paths?: string[];
  /** Vector store filter */
  filter?: Record<string, unknown>;
}
```

### SearchResult

```typescript
interface SearchResult {
  /** File path that was indexed */
  id: string;
  /** Content that matched */
  content: string;
  /** Search score */
  score: number;
  /** Line range where match was found */
  lineRange?: { start: number; end: number };
  /** Document metadata */
  metadata?: {
    type?: 'text' | 'image' | 'file';
    mimeType?: string;
    [key: string]: unknown;
  };
  /** Score breakdown by search type */
  scoreDetails?: {
    vector?: number;
    bm25?: number;
  };
}
```

---

## Implementation Tasks

### Phase 1: Copy Core Search Files

- [x] Analysis complete
- [ ] Create `packages/core/src/workspace/bm25.ts`
  - Copy from `packages/skills/src/bm25.ts`
  - Update imports (use @mastra/core/artifacts for LineRange)
  - Keep all functionality: tokenize, BM25Index, serialize/deserialize
- [ ] Create `packages/core/src/workspace/search-engine.ts`
  - Copy from `packages/skills/src/search-engine.ts`
  - Update imports to use local bm25.ts
  - Keep all functionality: BM25, vector, hybrid search

### Phase 2: Integrate Search into Workspace

- [ ] Update `packages/core/src/workspace/workspace.ts`
  - Add search configuration to WorkspaceConfig
  - Add SearchEngine as private member
  - Add search methods: index(), indexMany(), unindex(), search()
  - Add rebuildIndex() for auto-indexing
  - Add capability getters: canBM25, canVector, canHybrid

### Phase 3: Update Exports

- [ ] Update `packages/core/src/workspace/index.ts`
  - Export SearchEngine and types
  - Export BM25Index and types (for advanced use)
  - Export search-related types

### Phase 4: Auto-indexing

- [ ] Implement autoIndexPaths in Workspace.init()
  - Read files from specified paths
  - Index content in SearchEngine
  - Store serialized BM25 index in workspace state

### Phase 5: Integration Tests

- [ ] Test BM25 search
- [ ] Test vector search (with mock vector store)
- [ ] Test hybrid search
- [ ] Test auto-indexing
- [ ] Test index persistence

---

## Vector Index Naming

Per design decision, vector index names use workspace ID + path hash:

```typescript
function getVectorIndexName(workspaceId: string, path: string): string {
  const pathHash = createHash('sha256').update(path).digest('hex').slice(0, 8);
  return `${workspaceId}-${pathHash}`;
}
```

---

## Static Content Handling

Per design decision, static content is handled by processors, not Workspace:

```typescript
// Before: Knowledge handled static content
const staticContent = await knowledge.getStatic('policies');

// After: Processor handles static content
const agent = new Agent({
  workspace,
  processors: [
    new StaticContentProcessor({ paths: ['/policies'] }),
    new WorkspaceRetrievalProcessor({ searchPaths: ['/docs'] }),
  ],
});
```

This separation keeps Workspace focused on storage + search while processors handle context injection.

---

## Migration Guide (Future)

When Knowledge is deprecated, users will migrate like this:

```typescript
// Before
const knowledge = new Knowledge({
  id: 'support-kb',
  storage: new KnowledgeFilesystemStorage({ paths: ['./docs'] }),
  bm25: true,
});

await knowledge.add('default', { type: 'text', key: 'faq', content: '...' });
const results = await knowledge.search('default', 'password reset');

// After
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './data' }),
  bm25: true,
  autoIndexPaths: ['/docs'],
});

await workspace.writeFile('/docs/faq.md', '...');
await workspace.index('/docs/faq.md', '...');
const results = await workspace.search('password reset', { paths: ['/docs'] });
```

---

## Dependencies

### External (unchanged)

- `@mastra/core/vector` - MastraVector interface
- `@mastra/core/artifacts` - LineRange type

### Internal (new paths)

- `workspace/bm25.ts` - BM25Index
- `workspace/search-engine.ts` - SearchEngine

---

## Open Questions

### 1. BM25 Index Persistence

**Question**: Where to store serialized BM25 index?

**Decision**: Use Workspace state storage

```typescript
await workspace.state.set('bm25-index', this.searchEngine.bm25Index.serialize());
```

### 2. Vector Index Management

**Question**: Should Workspace create/manage vector indexes?

**Options**:

- A) Workspace creates indexes automatically
- B) User provides pre-created index name
- C) Workspace creates with naming convention (workspace ID + path hash) - **Selected**

### 3. Incremental vs Full Reindex

**Question**: How to handle updates to indexed files?

**Decision**:

- `rebuildIndex()` - Full rebuild from autoIndexPaths
- `index(path, content)` - Incremental update for single file
- Watch filesystem for changes (future)

---

## Related Documents

- [UNIFIED_WORKSPACE_DESIGN.md](./UNIFIED_WORKSPACE_DESIGN.md) - Core workspace design
- [SKILLS_MIGRATION_PLAN.md](./SKILLS_MIGRATION_PLAN.md) - Skills migration plan
- [WORKSPACE_PR_EXPLORATION.md](./WORKSPACE_PR_EXPLORATION.md) - PR #11567 analysis
