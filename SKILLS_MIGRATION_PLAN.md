# Skills Migration Plan

This document captures the analysis of the current Skills implementation and outlines the migration plan to integrate Skills as a directory convention within the unified Workspace.

**Status**: On hold until Knowledge migration is complete.

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

## Open Questions

### 1. Source Type Detection

**Question**: How do external and managed skills work with workspace?

**Options**:

- A) External skills fetched and cached in workspace filesystem
- B) External skills remain URL references, loaded on demand
- C) Only local skills supported initially, external/managed as future work

**Decision**: TBD

### 2. CRUD Operations

**Question**: Should Skills CRUD go through workspace filesystem or have dedicated methods?

**Options**:

- A) All CRUD via workspace.writeFile(), workspace.readFile(), etc.
- B) Dedicated workspace.skills.create(), workspace.skills.update(), etc.
- C) Hybrid - skills helper methods that use workspace filesystem internally

**Considerations**:

- Option A: Simpler, but loses skill-specific validation
- Option B: More ergonomic, but adds surface area
- Option C: Best of both, but more complex

**Decision**: TBD

### 3. Skill Validation

**Question**: Where does SKILL.md validation happen?

**Options**:

- A) In workspace at write time (workspace validates before saving)
- B) In processor at read time (SkillsProcessor validates when loading)
- C) Separate validation utility that can be called anywhere

**Decision**: TBD

### 4. SkillsProcessor Location

**Question**: Does SkillsProcessor stay in @mastra/skills or move to core?

**Options**:

- A) Move to `@mastra/core/workspace/processors/skills`
- B) Keep in `@mastra/skills` as an optional processor
- C) Split: core skills support in workspace, advanced processor in @mastra/skills

**Considerations**:

- If Skills is just a directory convention, processor can stay external
- But if Skills are deeply integrated with workspace, core makes sense

**Decision**: TBD

### 5. Search Integration

**Question**: Are skills auto-indexed for search or opt-in?

**Options**:

- A) Skills always indexed (part of autoIndexPaths default)
- B) Skills opt-in to indexing via config
- C) Skills have separate search (current behavior) vs workspace search

**Considerations**:

- Current Skills has its own search via SearchEngine
- Workspace already has unified search
- Duplicating search seems wasteful

**Decision**: TBD

---

## Implementation Tasks

### Phase 1: Workspace Foundation (Current Focus)

- [ ] Migrate Knowledge storage to Workspace
- [ ] Migrate Knowledge search (BM25, vector, hybrid) to Workspace
- [ ] Add autoIndexPaths configuration
- [ ] Add skillsPaths configuration

### Phase 2: Skills Migration (This Doc)

- [ ] Create skills helper methods on Workspace
- [ ] Migrate skill discovery to use workspace filesystem
- [ ] Migrate skill parsing (keep gray-matter)
- [ ] Handle source type detection for workspace
- [ ] Update SkillsProcessor to use workspace

### Phase 3: Integration

- [ ] Update agent integration to use workspace.skills
- [ ] Update playground UI to use new APIs
- [ ] Migration guide for existing Skills users

---

## Related Documents

- [UNIFIED_WORKSPACE_DESIGN.md](./UNIFIED_WORKSPACE_DESIGN.md) - Core workspace design
- [AGENT_SKILLS_SPEC.md](./AGENT_SKILLS_SPEC.md) - Agent Skills specification
- [WORKSPACE_PR_EXPLORATION.md](./WORKSPACE_PR_EXPLORATION.md) - PR #11567 analysis
