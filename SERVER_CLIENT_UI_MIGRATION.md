# Server, Client SDK, and UI Migration Guide

This document outlines the migration from separate Skills/Knowledge APIs to the unified Workspace API.

**Status**: Planning

---

## Architecture Change

### Before (Current)

```
/api/skills/*           → Skills class
/api/knowledge/*        → Knowledge class (stubbed)
```

### After (Target)

```
/api/workspace/
├── fs/                 → Filesystem operations
│   ├── read            → Read file content
│   ├── write           → Write file content
│   ├── list            → List directory contents
│   ├── delete          → Delete file/directory
│   ├── mkdir           → Create directory
│   └── stat            → Get file/directory info
├── search              → Unified search (BM25/vector/hybrid)
├── index               → Index content for search
└── skills/             → Skills (subset of workspace)
    ├── list            → List discovered skills
    ├── :skillName      → Get skill details
    ├── :skillName/references
    └── search          → Search skills
```

---

## Server Migration

### Routes to Remove

| Route                                                 | Reason                               |
| ----------------------------------------------------- | ------------------------------------ |
| `/api/knowledge/namespaces`                           | Replaced by `/api/workspace/fs/list` |
| `/api/knowledge/namespaces/:namespace`                | Replaced by workspace fs operations  |
| `/api/knowledge/namespaces/:namespace/artifacts`      | Replaced by `/api/workspace/fs/list` |
| `/api/knowledge/namespaces/:namespace/artifacts/:key` | Replaced by `/api/workspace/fs/read` |
| `/api/knowledge/search`                               | Replaced by `/api/workspace/search`  |

### Routes to Move

| Current Route                             | New Route                                           |
| ----------------------------------------- | --------------------------------------------------- |
| `/api/skills`                             | `/api/workspace/skills`                             |
| `/api/skills/:skillName`                  | `/api/workspace/skills/:skillName`                  |
| `/api/skills/:skillName/references`       | `/api/workspace/skills/:skillName/references`       |
| `/api/skills/:skillName/references/:path` | `/api/workspace/skills/:skillName/references/:path` |
| `/api/skills/search`                      | `/api/workspace/skills/search`                      |

### New Routes to Add

#### Filesystem Routes

```typescript
// GET /api/workspace/fs/read?path=/path/to/file
// Returns file content
{
  path: string;
  content: string;
  type: 'file' | 'directory';
  size?: number;
  mimeType?: string;
}

// POST /api/workspace/fs/write
// Body: { path: string; content: string; }
{
  success: boolean;
  path: string;
}

// GET /api/workspace/fs/list?path=/path/to/dir
// Returns directory listing
{
  path: string;
  entries: Array<{
    name: string;
    type: 'file' | 'directory';
    size?: number;
  }>;
}

// DELETE /api/workspace/fs/delete?path=/path
{
  success: boolean;
  path: string;
}

// POST /api/workspace/fs/mkdir
// Body: { path: string; }
{
  success: boolean;
  path: string;
}

// GET /api/workspace/fs/stat?path=/path
{
  path: string;
  type: 'file' | 'directory';
  size?: number;
  createdAt?: string;
  modifiedAt?: string;
}
```

#### Search Routes

```typescript
// GET /api/workspace/search?query=...&topK=5&mode=bm25&paths=/docs,/knowledge
{
  results: Array<{
    id: string; // file path
    content: string;
    score: number;
    lineRange?: { start: number; end: number };
    scoreDetails?: { vector?: number; bm25?: number };
  }>;
  query: string;
  mode: 'bm25' | 'vector' | 'hybrid';
}

// POST /api/workspace/index
// Body: { path: string; content: string; metadata?: Record<string, unknown>; }
{
  success: boolean;
  path: string;
}

// DELETE /api/workspace/unindex?path=/path
{
  success: boolean;
  path: string;
}
```

### Server File Changes

| File                           | Action                                              |
| ------------------------------ | --------------------------------------------------- |
| `handlers/knowledge.ts`        | **Delete**                                          |
| `handlers/skills.ts`           | **Move** to `handlers/workspace/skills.ts`          |
| `handlers/workspace/index.ts`  | **Create** - exports all workspace handlers         |
| `handlers/workspace/fs.ts`     | **Create** - filesystem handlers                    |
| `handlers/workspace/search.ts` | **Create** - search handlers                        |
| `handlers/workspace/skills.ts` | **Create** - skills handlers (move from skills.ts)  |
| `schemas/knowledge.ts`         | **Delete**                                          |
| `schemas/skills.ts`            | **Keep** - used by workspace/skills                 |
| `schemas/workspace.ts`         | **Create** - fs and search schemas                  |
| `routes/knowledge.ts`          | **Delete**                                          |
| `routes/skills.ts`             | **Delete**                                          |
| `routes/workspace.ts`          | **Create** - all workspace routes                   |
| `routes/index.ts`              | **Update** - remove knowledge/skills, add workspace |

---

## Client SDK Migration

### Current Structure

```
client-js/src/resources/
├── skill.ts      → SkillResource class
├── knowledge.ts  → Knowledge class
└── ...
```

### Target Structure

```
client-js/src/resources/
├── workspace.ts  → WorkspaceResource class (new)
└── ...           → (remove skill.ts and knowledge.ts)
```

### New WorkspaceResource API

```typescript
class WorkspaceResource extends BaseResource {
  // Filesystem operations
  fs: {
    read(path: string): Promise<FileContent>;
    write(path: string, content: string): Promise<void>;
    list(path: string): Promise<DirectoryListing>;
    delete(path: string): Promise<void>;
    mkdir(path: string): Promise<void>;
    stat(path: string): Promise<FileStat>;
  };

  // Search operations
  search(query: string, options?: SearchOptions): Promise<SearchResults>;
  index(path: string, content: string, metadata?: object): Promise<void>;
  unindex(path: string): Promise<void>;

  // Skills (convenience methods)
  skills: {
    list(): Promise<SkillMetadata[]>;
    get(name: string): Promise<Skill>;
    listReferences(name: string): Promise<string[]>;
    getReference(name: string, path: string): Promise<string>;
    search(query: string, options?: SkillSearchOptions): Promise<SkillSearchResult[]>;
  };
}

// Usage
const workspace = client.workspace();
await workspace.fs.write('/docs/readme.md', 'Hello');
const results = await workspace.search('authentication');
const skills = await workspace.skills.list();
```

### Client SDK File Changes

| File                     | Action                                                                |
| ------------------------ | --------------------------------------------------------------------- |
| `resources/skill.ts`     | **Delete**                                                            |
| `resources/knowledge.ts` | **Delete**                                                            |
| `resources/workspace.ts` | **Create**                                                            |
| `resources/index.ts`     | **Update** - export workspace, remove skill/knowledge                 |
| `client.ts`              | **Update** - add `workspace()` method, remove `skill()`/`knowledge()` |
| `types.ts`               | **Update** - add workspace types, remove skill/knowledge types        |

---

## Playground UI Migration

### Current Structure

```
playground-ui/src/domains/
├── skills/
│   ├── hooks/use-skills.ts
│   └── components/...
├── knowledge/
│   ├── hooks/use-knowledge.ts
│   └── components/...
└── ...
```

### Target Structure

```
playground-ui/src/domains/
├── workspace/
│   ├── hooks/
│   │   ├── use-workspace-fs.ts
│   │   ├── use-workspace-search.ts
│   │   └── use-workspace-skills.ts
│   └── components/
│       ├── file-browser.tsx
│       ├── file-editor.tsx
│       ├── search-panel.tsx
│       ├── skills-table.tsx
│       ├── skill-detail.tsx
│       └── ...
└── ...
```

### Hooks to Create

```typescript
// use-workspace-fs.ts
export const useWorkspaceFile = (path: string) => { ... };
export const useWorkspaceDirectory = (path: string) => { ... };
export const useWriteFile = () => { ... };  // mutation
export const useDeleteFile = () => { ... }; // mutation
export const useCreateDirectory = () => { ... }; // mutation

// use-workspace-search.ts
export const useWorkspaceSearch = () => { ... }; // mutation
export const useIndexFile = () => { ... }; // mutation

// use-workspace-skills.ts (mostly same as current use-skills.ts)
export const useSkills = () => { ... };
export const useSkill = (name: string) => { ... };
export const useSkillReferences = (name: string) => { ... };
export const useSkillReference = (name: string, path: string) => { ... };
export const useSearchSkills = () => { ... };
```

### Components to Migrate

| Current                                         | Action                                             |
| ----------------------------------------------- | -------------------------------------------------- |
| `skills/components/skills-table.tsx`            | **Move** to `workspace/components/`                |
| `skills/components/skill-detail.tsx`            | **Move** to `workspace/components/`                |
| `skills/components/search-skills-panel.tsx`     | **Move** to `workspace/components/`                |
| `skills/components/reference-viewer-dialog.tsx` | **Move** to `workspace/components/`                |
| `knowledge/components/*`                        | **Replace** with workspace file browser components |

### New Components

```typescript
// file-browser.tsx - Browse workspace filesystem
export function FileBrowser({ path, onSelect }: FileBrowserProps) { ... }

// file-editor.tsx - View/edit file content
export function FileEditor({ path }: FileEditorProps) { ... }

// search-panel.tsx - Unified search across workspace
export function WorkspaceSearchPanel() { ... }
```

### Playground UI File Changes

| File/Folder                     | Action                                                 |
| ------------------------------- | ------------------------------------------------------ |
| `domains/skills/`               | **Delete** (after moving to workspace)                 |
| `domains/knowledge/`            | **Delete**                                             |
| `domains/workspace/`            | **Create**                                             |
| `domains/workspace/hooks/`      | **Create**                                             |
| `domains/workspace/components/` | **Create**                                             |
| `domains/workspace/index.ts`    | **Create**                                             |
| `index.ts`                      | **Update** - export workspace, remove skills/knowledge |

---

## Playground Pages Migration

### Current Structure

```
playground/src/pages/
├── skills/
│   ├── index.tsx
│   └── [skillName]/index.tsx
├── knowledge/
│   ├── index.tsx
│   └── [namespace]/index.tsx
└── ...
```

### Target Structure

```
playground/src/pages/
├── workspace/
│   ├── index.tsx           → File browser root
│   ├── [...path]/index.tsx → File browser for any path
│   ├── skills/
│   │   ├── index.tsx       → Skills listing
│   │   └── [skillName]/index.tsx → Skill detail
│   └── search/index.tsx    → Search page
└── ...
```

### Page Changes

| Current                                 | Action                                                     |
| --------------------------------------- | ---------------------------------------------------------- |
| `pages/skills/index.tsx`                | **Move** to `pages/workspace/skills/index.tsx`             |
| `pages/skills/[skillName]/index.tsx`    | **Move** to `pages/workspace/skills/[skillName]/index.tsx` |
| `pages/knowledge/index.tsx`             | **Delete** (replaced by file browser)                      |
| `pages/knowledge/[namespace]/index.tsx` | **Delete** (replaced by file browser)                      |
| `pages/workspace/index.tsx`             | **Create** - workspace root/file browser                   |
| `pages/workspace/[...path]/index.tsx`   | **Create** - dynamic path file browser                     |
| `pages/workspace/search/index.tsx`      | **Create** - search page                                   |

### Sidebar Navigation Update

```typescript
// Update app-sidebar.tsx
const workspaceNavItems = [
  { title: 'Files', url: '/workspace', icon: FolderIcon },
  { title: 'Skills', url: '/workspace/skills', icon: SkillIcon },
  { title: 'Search', url: '/workspace/search', icon: SearchIcon },
];

// Remove separate skills/knowledge nav items
```

---

## Implementation Order

### Phase 1: Server Routes

1. Create `handlers/workspace/` folder structure
2. Create filesystem handlers (`fs.ts`)
3. Create search handlers (`search.ts`)
4. Move skills handlers to `workspace/skills.ts`
5. Create workspace routes file
6. Update routes index - add workspace, remove knowledge/skills
7. Delete old knowledge handlers and routes

### Phase 2: Client SDK

1. Create `workspace.ts` resource
2. Update `client.ts` with workspace() method
3. Add workspace types to `types.ts`
4. Remove skill.ts and knowledge.ts
5. Update index exports

### Phase 3: Playground UI

1. Create `domains/workspace/` folder structure
2. Create workspace hooks
3. Move/adapt skills components
4. Create new file browser components
5. Delete skills and knowledge domains
6. Update main index exports

### Phase 4: Playground Pages

1. Create workspace pages folder structure
2. Move skills pages
3. Create file browser pages
4. Create search page
5. Delete old knowledge pages
6. Update sidebar navigation

---

## Migration Checklist

### Server

- [ ] Create `handlers/workspace/fs.ts`
- [ ] Create `handlers/workspace/search.ts`
- [ ] Move `handlers/skills.ts` → `handlers/workspace/skills.ts`
- [ ] Create `handlers/workspace/index.ts`
- [ ] Create `schemas/workspace.ts`
- [ ] Create `routes/workspace.ts`
- [ ] Update `routes/index.ts`
- [ ] Delete `handlers/knowledge.ts`
- [ ] Delete `routes/knowledge.ts`
- [ ] Delete `routes/skills.ts`

### Client SDK

- [ ] Create `resources/workspace.ts`
- [ ] Update `client.ts`
- [ ] Update `types.ts`
- [ ] Delete `resources/skill.ts`
- [ ] Delete `resources/knowledge.ts`
- [ ] Update `resources/index.ts`

### Playground UI

- [ ] Create `domains/workspace/hooks/use-workspace-fs.ts`
- [ ] Create `domains/workspace/hooks/use-workspace-search.ts`
- [ ] Create `domains/workspace/hooks/use-workspace-skills.ts`
- [ ] Move skills components to workspace
- [ ] Create file browser components
- [ ] Create `domains/workspace/index.ts`
- [ ] Delete `domains/skills/`
- [ ] Delete `domains/knowledge/`
- [ ] Update main `index.ts`

### Playground Pages

- [ ] Create `pages/workspace/index.tsx`
- [ ] Create `pages/workspace/[...path]/index.tsx`
- [ ] Move `pages/skills/` → `pages/workspace/skills/`
- [ ] Create `pages/workspace/search/index.tsx`
- [ ] Delete `pages/knowledge/`
- [ ] Update sidebar navigation

---

## Related Documents

- [SKILLS_MIGRATION_PLAN.md](./SKILLS_MIGRATION_PLAN.md) - Core skills migration (complete)
- [KNOWLEDGE_MIGRATION_PLAN.md](./KNOWLEDGE_MIGRATION_PLAN.md) - Core knowledge migration (complete)
- [UNIFIED_WORKSPACE_DESIGN.md](./UNIFIED_WORKSPACE_DESIGN.md) - Core workspace design
