# Skills Migration Plan

This document captures the analysis of the current Skills implementation and outlines the migration plan to integrate Skills as a directory convention within the unified Workspace.

**Status**: ✅ Complete

---

## Current Skills Implementation

### Location

`packages/skills/src/skills.ts`

### Core Features

| Feature          | Description                         | Implementation                |
| ---------------- | ----------------------------------- | ----------------------------- |
| **Discovery**    | Scan paths for SKILL.md files       | `discover()` - recursive glob |
| **Parsing**      | Extract frontmatter + content       | `gray-matter` library         |
| **CRUD**         | Create, read, update, delete skills | Methods on Skills class       |
| **Search**       | BM25 search across skills           | Via SearchEngine              |
| **Source Types** | local, managed, external            | Automatic detection           |
| **References**   | Load `references/` subdirectory     | `getReferences()`             |

### Skill Structure (Agent Skills Spec)

```
skill-name/
├── SKILL.md          # Required: instructions + metadata
├── scripts/          # Optional: executable code
├── references/       # Optional: additional documentation
└── assets/           # Optional: templates, resources
```

### Skills Class API

```typescript
class Skills {
  // Discovery & listing
  list(): SkillMetadata[];
  listDirectory(dir: string): SkillMetadata[];

  // Get skill content
  get(name: string): Skill | undefined;
  getSkillPath(name: string): string | undefined;

  // CRUD operations
  createSkill(name: string, content: string): Promise<string>;
  updateSkill(name: string, content: string): Promise<void>;
  deleteSkill(name: string): Promise<void>;

  // Search
  search(query: string, options?): Promise<SearchResult[]>;

  // References
  getReferences(name: string): Promise<SkillReference[]>;

  // Scripts (if sandbox available)
  runScript(skillName: string, scriptPath: string, args: string[]): Promise<ScriptResult>;
}
```

### Source Type Detection

```typescript
type SkillSourceType = 'local' | 'managed' | 'external';

// Current logic:
// - external: path starts with http:// or https://
// - managed: path includes 'node_modules'
// - local: everything else
```

---

## Comparison: Skills vs Workspace

| Aspect        | Skills (Current)         | Workspace (Target)                       |
| ------------- | ------------------------ | ---------------------------------------- |
| **Storage**   | File-based only          | Provider-based (Local, AgentFS, RAM)     |
| **Search**    | BM25 via SearchEngine    | BM25 + Vector + Hybrid                   |
| **CRUD**      | Direct file ops          | Via filesystem provider                  |
| **Paths**     | Multiple `paths[]`       | Single workspace, `skillsPaths[]` config |
| **Scope**     | Global only              | global, agent, thread                    |
| **Execution** | Optional (needs sandbox) | Integrated sandbox provider              |

---

## Migration Strategy

### What Stays the Same

1. **SKILL.md format** - Agent Skills spec compliance
2. **Directory structure** - `scripts/`, `references/`, `assets/`
3. **Frontmatter parsing** - `gray-matter` for metadata extraction
4. **Progressive disclosure** - Discovery → Activation → Execution

### What Changes

1. **Storage layer** - Skills use Workspace filesystem instead of direct fs
2. **Path resolution** - Skills paths are relative to workspace root
3. **Search integration** - Skills searchable via workspace's unified search
4. **Scoping** - Skills can be scoped per workspace (global/agent/thread)

### Configuration

```typescript
interface WorkspaceConfig {
  // ... other config
  skillsPaths?: string[]; // Default: ['/skills']
}

// Usage
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './data' }),
  skillsPaths: ['/skills', '/custom-skills'],
});
```

---

## Open Questions (Resolved)

### 1. Source Type Detection ✅

**Question**: How do external and managed skills work with workspace?

**Decision**: Source types become less relevant for Workspace itself. Workspace's filesystem is a single abstraction. Skills are files at `skillsPaths` within the workspace filesystem.

**Future Work**: Note for later - may want to support external skills (from packages, URLs) via:

- Copying into workspace
- Multi-mount filesystem providers
- URL fetching and caching

For now, focus on local workspace skills.

### 2. CRUD Operations ✅

**Question**: Should Skills CRUD go through workspace filesystem or have dedicated methods?

**Decision**: Option C - Hybrid approach with skill helper methods on Workspace.

```typescript
// Helper methods that use workspace filesystem internally
workspace.createSkill(name, input); // Validates, creates directory structure
workspace.updateSkill(name, input); // Validates, updates SKILL.md
workspace.deleteSkill(name); // Removes skill directory
```

Provides good UX (validation, proper directory structure) while using workspace filesystem internally.

### 3. Skill Validation ✅

**Question**: Where does SKILL.md validation happen?

**Decision**: Option C - Separate validation utility that can be called anywhere.

- Keep `validateSkillMetadata()` and Zod schemas as utilities
- Can be called by `createSkill()` helper, processors, or users directly
- Lives in `core/workspace/skill-schemas.ts`

### 4. SkillsProcessor Location ✅

**Question**: Does SkillsProcessor stay in @mastra/skills or move to core?

**Decision**: Move to `@mastra/core/processors`.

The processor is tightly coupled with core agent behavior:

- Tool injection (`skill_search`, `skill_read`, `skill_activate`)
- System message injection for activated skills

Skill tools remain skill-specific (not workspace tools).

### 5. Search Integration ✅

**Question**: Are skills auto-indexed for search or opt-in?

**Decision**: Option B - Opt-in via config.

```typescript
const workspace = new Workspace({
  skillsPaths: ['/skills'],
  autoIndexPaths: ['/skills'], // Opt-in: add skillsPaths here to enable search
  bm25: true,
});
```

If `skillsPaths` is set but not in `autoIndexPaths`, skills are readable but not searchable.

---

## Additional Decisions

### 6. Skills Interface ✅

**Question**: Does `MastraSkills` interface stay in `core/skills` or move?

**Decision**: Option C - `WorkspaceSkills` interface accessed via `workspace.skills`.

- `MastraSkills` becomes `WorkspaceSkills` interface
- Accessed via nested accessor: `workspace.skills.list()`, `workspace.skills.get()`, etc.
- Skills are NOT directly exposed on agents or Mastra instance
- Skills are accessed through workspace: `agent.workspace.skills` or `mastra.workspace.skills`

```typescript
interface WorkspaceSkills {
  // Discovery
  list(): Promise<SkillMetadata[]>;
  get(name: string): Promise<Skill | null>;
  has(name: string): Promise<boolean>;
  refresh(): Promise<void>; // Re-scan skillsPaths

  // Search
  search(query: string, options?: SkillSearchOptions): Promise<SkillSearchResult[]>;

  // CRUD
  create(input: CreateSkillInput): Promise<Skill>;
  update(name: string, input: UpdateSkillInput): Promise<Skill>;
  delete(name: string): Promise<void>;

  // Single-item accessors
  getReference(skillName: string, path: string): Promise<string | null>;
  getScript(skillName: string, path: string): Promise<string | null>;
  getAsset(skillName: string, path: string): Promise<Buffer | null>;

  // Listing accessors (for SkillsProcessor tools)
  listReferences(skillName: string): Promise<string[]>;
  listScripts(skillName: string): Promise<string[]>;
  listAssets(skillName: string): Promise<string[]>;
}

// Usage
const skills = await workspace.skills.list();
const skill = await workspace.skills.get('brand-guidelines');
const results = await workspace.skills.search('brand colors');
const refs = await workspace.skills.listReferences('brand-guidelines');
```

This keeps skills as a coherent subsystem while living within workspace.

### 7. @mastra/skills Package Fate

**Question**: What happens to the @mastra/skills package?

**Decision**: Deprecate - functionality moves to core.

- `Skills` class functionality → Workspace skill methods
- `SkillsProcessor` → `@mastra/core/processors`
- `SearchEngine`, `BM25Index` → Already in `@mastra/core/workspace`
- `schemas.ts` → `@mastra/core/workspace/skill-schemas.ts`
- Knowledge classes → Removed (replaced by Workspace search)

### 8. Dependencies

**gray-matter**: Move to core as dependency for SKILL.md parsing.

**Zod schemas**: Move to `core/workspace/skill-schemas.ts`.

### 9. SkillsProcessor Auto-Creation ✅

**Question**: How does Agent know to create SkillsProcessor when workspace has `skillsPaths`?

**Decision**: Option A - Agent auto-creates processor when workspace has skillsPaths.

```typescript
// In Agent.#getInputProcessorWorkflow():
// Check if workspace has skillsPaths configured
const workspace = await this.getWorkspace({ requestContext });
if (workspace?.skillsPaths?.length > 0) {
  const skillsProcessor = new SkillsProcessor({ workspace, format });
  // Add to processors
}
```

This follows the Memory pattern where processors are auto-created when the feature is configured.
Users can still override by providing their own processor in `inputProcessors`.

### 10. WorkspaceSkills Additional Methods ✅

**Question**: Should WorkspaceSkills include listing methods for references/scripts/assets?

**Decision**: Yes - add methods to match MastraSkills parity. These are needed by SkillsProcessor tools to show available files when a requested file is not found.

Added to WorkspaceSkills (see full interface in Decision 6):

- `listReferences(skillName: string): Promise<string[]>`
- `listScripts(skillName: string): Promise<string[]>`
- `listAssets(skillName: string): Promise<string[]>`
- `refresh(): Promise<void>` - re-scan skillsPaths

### 11. Sync to Async API Change ✅

**Question**: MastraSkills uses sync methods, WorkspaceSkills uses async. Is this intentional?

**Decision**: Yes - this is intentional. Workspace filesystem providers are async, so all operations through workspace.skills must be async.

**Impact**:

- SkillsProcessor must be updated to use async methods
- Tool execute functions already support async, so no change needed there
- System message injection happens in `processInputStep()` which is already async

### 12. Skills Format Configuration ✅

**Question**: Where does `skillsFormat` live after removing `AgentSkillsConfig`?

**Decision**: Add `skillsFormat` as a standalone agent config option.

```typescript
// Agent config (after migration)
interface AgentConfig {
  // ... other config
  workspace?: DynamicArgument<Workspace>;
  skillsFormat?: SkillFormat; // 'xml' | 'json' | 'markdown', default: 'xml'
}
```

This keeps format as agent-level config since it controls how skills are presented in the agent's context. The format is passed to SkillsProcessor when auto-created.

---

## Implementation Tasks

### Phase 1: Workspace Foundation ✅ (Complete)

- [x] Migrate Knowledge storage to Workspace
- [x] Migrate Knowledge search (BM25, vector, hybrid) to Workspace
- [x] Add autoIndexPaths configuration
- [x] Add skillsPaths configuration
- [x] Remove `core/knowledge` folder
- [x] Clean up Mastra class (remove knowledge references)

### Phase 2: Skills Types & Schemas ✅ (Complete)

- [x] Move skill type definitions to `core/workspace/skill-types.ts`
  - `Skill`, `SkillMetadata`, `SkillSearchResult`, `SkillSearchOptions`
  - `CreateSkillInput`, `UpdateSkillInput`
  - `SkillFormat` ('xml' | 'json' | 'markdown')
  - `WorkspaceSkills` interface
- [x] Move validation schemas to `core/workspace/skill-schemas.ts`
  - `validateSkillMetadata()`, Zod schemas
  - `parseAllowedTools()`
- [x] Move utility functions via bm25.ts export
  - `extractLines()` - used by SkillsProcessor for line range extraction
- [x] Add `gray-matter` as core dependency
- [x] Update exports in `core/workspace/index.ts`

### Phase 3: Workspace Skill Methods ✅ (Complete)

- [x] Implement `WorkspaceSkills` class as nested accessor on Workspace
  - Created `core/workspace/workspace-skills.ts`
  - Added `skills` getter to Workspace class with lazy initialization
- [x] Add skill discovery methods
  - `list(): Promise<SkillMetadata[]>`
  - `get(name: string): Promise<Skill | null>`
  - `has(name: string): Promise<boolean>`
  - `refresh(): Promise<void>` - re-scan skillsPaths
- [x] Add skill search (uses workspace's SearchEngine)
  - `search(query: string, options?: SkillSearchOptions): Promise<SkillSearchResult[]>`
- [x] Add skill CRUD helpers
  - `create(input: CreateSkillInput): Promise<Skill>`
  - `update(name: string, input: UpdateSkillInput): Promise<Skill>`
  - `delete(name: string): Promise<void>`
- [x] Add single-item accessors
  - `getReference(skillName: string, path: string): Promise<string | null>`
  - `getScript(skillName: string, path: string): Promise<string | null>`
  - `getAsset(skillName: string, path: string): Promise<Buffer | null>`
- [x] Add listing methods (for SkillsProcessor tools)
  - `listReferences(skillName: string): Promise<string[]>`
  - `listScripts(skillName: string): Promise<string[]>`
  - `listAssets(skillName: string): Promise<string[]>`

### Phase 4: SkillsProcessor Migration ✅ (Complete)

- [x] Move `SkillsProcessor` to `core/processors/processors/skills.ts`
- [x] Update processor constructor to accept `Workspace` instead of `Skills | MastraSkills`
  ```typescript
  constructor(opts: { workspace: Workspace; format?: SkillFormat })
  ```
- [x] Update all internal methods to use async `workspace.skills.*` methods
- [x] Update tool implementations:
  - `skill-activate` - use `workspace.skills.has()`, `workspace.skills.get()`
  - `skill-search` - use `workspace.skills.search()`
  - `skill-read-reference` - use `workspace.skills.getReference()`, `workspace.skills.listReferences()`
  - `skill-read-script` - use `workspace.skills.getScript()`, `workspace.skills.listScripts()`
  - `skill-read-asset` - use `workspace.skills.getAsset()`, `workspace.skills.listAssets()`
- [x] Update `processInputStep()` to await async skill operations
- [x] Export from `core/processors/processors/index.ts`

### Phase 5: Mastra & Agent Class Cleanup ✅ (Complete - Backward Compatible)

**Decision**: Keep legacy APIs for backward compatibility. New code uses workspace.skills, old code continues to work.

**Agent class (`core/agent/agent.ts`):**

- [x] Keep `getSkills(): MastraSkills | undefined` method for backward compatibility
- [x] Keep `isMastraSkills()` type guard function for type checking
- [x] Update `getSkillsProcessors()` to prefer `workspace.skills` over legacy:
  ```typescript
  // Checks workspace.skills first (new Workspace-based skills)
  // Falls back to legacy MastraSkills approach
  const workspace = await this.getWorkspace({ requestContext });
  if (workspace?.skills) {
    return [new SkillsProcessor({ workspace, format })];
  }
  // Fall back to legacy: return skills.getInputProcessors(...)
  ```
- [x] Keep `AgentSkillsConfig` and `AgentSkillsOption` types for backward compatibility

**Mastra class (`core/mastra/index.ts`):**

- [x] Keep `#skills?: MastraSkills` private field
- [x] Keep `getSkills(): MastraSkills | undefined` method
- [x] Keep `skills?: MastraSkills` in Config

**Core skills folder (`core/skills/`):**

- [x] Keep `MastraSkills` interface in `core/skills/types.ts` for backward compatibility
- [x] Add new `WorkspaceSkills` interface in `core/workspace/skill-types.ts`

### Phase 6: Deprecate @mastra/skills ✅ (Complete)

- [x] Add `@deprecated` JSDoc to `Skills` class with migration guide
- [x] Add `@deprecated` JSDoc to `SkillsProcessor` class with migration guide
- [x] Package already re-exports types from core for backward compatibility
- [x] Knowledge classes remain (separate migration or already done)

### Phase 7: Server, Playground & Testing ✅ (Complete - Backward Compatible)

**Server handlers (`packages/server/src/server/handlers/skills.ts`):**

- [x] Server handlers continue to use `mastra.getSkills()` and `agent.getSkills()` (sync API)
- [x] This is backward compatible - users configuring `mastra.skills` get the sync API
- [x] No changes needed - handlers work with existing `MastraSkills` interface

**Note**: Server handlers don't need to migrate to async `workspace.skills` API because:

1. The legacy `MastraSkills` interface is kept for backward compatibility
2. Users who configure skills via `new Mastra({ skills })` get the sync API
3. Users who configure skills via workspace get the async API internally (via SkillsProcessor)
4. Server handlers expose the global skills API, which remains sync for backward compatibility

**Future Work** (optional, not required for this migration):

- Server handlers could be updated to also support `workspace.skills` if needed
- This would require async handlers and conditional logic for sync vs async APIs

---

## Migration Path for Users

### Before (Current)

```typescript
import { Skills, SkillsProcessor } from '@mastra/skills';

const skills = new Skills({
  id: 'my-skills',
  paths: ['./skills'],
});

const agent = new Agent({
  skills,
  // ...
});
```

### After (Target)

```typescript
import { Workspace, LocalFilesystem } from '@mastra/core';

const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './data' }),
  skillsPaths: ['/skills'],
  bm25: true,
});

const agent = new Agent({
  workspace,
  // SkillsProcessor auto-created when workspace has skillsPaths
});

// Or explicit processor control:
const agent = new Agent({
  workspace,
  processors: [new SkillsProcessor({ workspace })],
});
```

---

## Related Documents

- [UNIFIED_WORKSPACE_DESIGN.md](./UNIFIED_WORKSPACE_DESIGN.md) - Core workspace design
- [KNOWLEDGE_MIGRATION_PLAN.md](./KNOWLEDGE_MIGRATION_PLAN.md) - Knowledge migration (complete)
- [AGENT_SKILLS_SPEC.md](./AGENT_SKILLS_SPEC.md) - Agent Skills specification
- [WORKSPACE_PR_EXPLORATION.md](./WORKSPACE_PR_EXPLORATION.md) - PR #11567 analysis
