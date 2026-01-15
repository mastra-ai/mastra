# Skills Migration Plan

This document captures the analysis of the current Skills implementation and outlines the migration plan to integrate Skills as a directory convention within the unified Workspace.

**Status**: In Progress (Knowledge migration complete)

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

### 6. Skills Interface

**Question**: Does `MastraSkills` interface stay in `core/skills` or move?

**Decision**: TBD - needs more thought.

The SKILL.md spec defines a structure (references/, scripts/, assets/). Having an interface equipped to deal with that structure still makes sense, but it could:

- A) Stay as `MastraSkills` interface in `core/skills`
- B) Become skill types/helpers inside `core/workspace` (no separate `core/skills`)
- C) Be a new `WorkspaceSkills` interface on Workspace

**Consideration**: Skills have a defined spec structure. Even if skills live in workspace, the interface for interacting with them (parsing SKILL.md, getting references, etc.) may warrant its own type definitions.

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

---

## Implementation Tasks

### Phase 1: Workspace Foundation ✅ (Complete)

- [x] Migrate Knowledge storage to Workspace
- [x] Migrate Knowledge search (BM25, vector, hybrid) to Workspace
- [x] Add autoIndexPaths configuration
- [x] Add skillsPaths configuration
- [x] Remove `core/knowledge` folder
- [x] Clean up Mastra class (remove knowledge references)

### Phase 2: Skills Types & Schemas

- [ ] Move skill type definitions to `core/workspace/skill-types.ts`
  - `Skill`, `SkillMetadata`, `SkillSearchResult`, `SkillSearchOptions`
  - `CreateSkillInput`, `UpdateSkillInput`
- [ ] Move validation schemas to `core/workspace/skill-schemas.ts`
  - `validateSkillMetadata()`, Zod schemas
  - `parseAllowedTools()`
- [ ] Add `gray-matter` as core dependency
- [ ] Update exports in `core/workspace/index.ts`

### Phase 3: Workspace Skill Methods

- [ ] Add skill discovery to Workspace
  - `listSkills(): Promise<SkillMetadata[]>`
  - `getSkill(name: string): Promise<Skill | null>`
  - `hasSkill(name: string): Promise<boolean>`
- [ ] Add skill search (uses workspace's SearchEngine)
  - `searchSkills(query: string, options?: SkillSearchOptions): Promise<SkillSearchResult[]>`
- [ ] Add skill CRUD helpers
  - `createSkill(name: string, input: CreateSkillInput): Promise<Skill>`
  - `updateSkill(name: string, input: UpdateSkillInput): Promise<Skill>`
  - `deleteSkill(name: string): Promise<void>`
- [ ] Add reference/script/asset accessors
  - `getSkillReference(skillName: string, path: string): Promise<string | null>`
  - `getSkillScript(skillName: string, path: string): Promise<string | null>`
  - `getSkillAsset(skillName: string, path: string): Promise<Buffer | null>`

### Phase 4: SkillsProcessor Migration

- [ ] Move `SkillsProcessor` to `core/processors/skills-processor.ts`
- [ ] Update processor to work with Workspace skill methods
- [ ] Keep skill-specific tools (`skill_search`, `skill_read`, `skill_activate`)
- [ ] Update processor tests

### Phase 5: Mastra Class Cleanup

- [ ] Remove `#skills` private field from Mastra
- [ ] Remove `getSkills()` method from Mastra
- [ ] Remove `skills?: MastraSkills` from MastraOptions
- [ ] Update agent integration to use workspace

### Phase 6: Deprecate @mastra/skills

- [ ] Mark package as deprecated
- [ ] Update package to re-export from core (for backwards compat)
- [ ] Migration guide for existing users
- [ ] Remove old Knowledge classes from package

### Phase 7: Integration & Testing

- [ ] Move skill tests to core/workspace
- [ ] Update playground UI to use new APIs
- [ ] End-to-end testing with agents

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

## Open Items for Discussion

### Skills Interface Design

The `MastraSkills` interface currently defines:

- `list()`, `get()`, `has()`, `search()`
- `create()`, `update()`, `delete()`
- `getReference()`, `getScript()`, `getAsset()`
- `refresh()`, `getInputProcessors()`

Options for Workspace integration:

1. **Flat methods on Workspace**: `workspace.listSkills()`, `workspace.getSkill()`, etc.
2. **Nested accessor**: `workspace.skills.list()`, `workspace.skills.get()`, etc.
3. **Separate interface**: Keep `MastraSkills` interface, Workspace implements it

**Recommendation**: Option 1 (flat methods) for simplicity. Skills are a workspace feature, not a separate subsystem.

---

## Related Documents

- [UNIFIED_WORKSPACE_DESIGN.md](./UNIFIED_WORKSPACE_DESIGN.md) - Core workspace design
- [KNOWLEDGE_MIGRATION_PLAN.md](./KNOWLEDGE_MIGRATION_PLAN.md) - Knowledge migration (complete)
- [AGENT_SKILLS_SPEC.md](./AGENT_SKILLS_SPEC.md) - Agent Skills specification
- [WORKSPACE_PR_EXPLORATION.md](./WORKSPACE_PR_EXPLORATION.md) - PR #11567 analysis
