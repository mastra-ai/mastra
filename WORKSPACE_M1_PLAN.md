# Workspace M1 (Initial Release) - Implementation Plan

This document outlines the implementation order and dependencies for Workspace tickets in the Initial Release milestone.

## Your Tickets (Nik)

| Ticket                                                 | Title                                  | Priority | Status  |
| ------------------------------------------------------ | -------------------------------------- | -------- | ------- |
| [COR-377](https://linear.app/kepler-crm/issue/COR-377) | API Cleanup - Remove premature exports | High     | Todo    |
| [COR-408](https://linear.app/kepler-crm/issue/COR-408) | Conditional Tool Injection API         | Medium   | Todo    |
| [COR-401](https://linear.app/kepler-crm/issue/COR-401) | Safety flags in Workspace UI           | -        | Backlog |
| [COR-402](https://linear.app/kepler-crm/issue/COR-402) | Workspace Documentation                | High     | Todo    |
| [COR-422](https://linear.app/kepler-crm/issue/COR-422) | Strip Allowed Tools for Skills         | Low      | Todo    |

## Other Active Tickets (affects timing)

| Ticket                                                 | Title                                | Assignee   | Status      |
| ------------------------------------------------------ | ------------------------------------ | ---------- | ----------- |
| [COR-424](https://linear.app/kepler-crm/issue/COR-424) | Workspace tools output optimizations | Caleb      | In Progress |
| [COR-427](https://linear.app/kepler-crm/issue/COR-427) | Skills Runtime Refresh               | Caleb      | In Review   |
| [COR-397](https://linear.app/kepler-crm/issue/COR-397) | Tree-style list_files output         | Caleb      | Todo        |
| [COR-403](https://linear.app/kepler-crm/issue/COR-403) | Integration Tests with Real Agents   | Unassigned | Todo        |

---

## Dependency Graph

```
COR-422 (Strip allowed tools)     COR-377 (API Cleanup)
         │                               │
         │                               ▼
         │                        COR-408 (Tool Injection API)
         │                               │
         │                               ▼
         │                        COR-401 (Safety UI) [may defer]
         │                               │
         └───────────────────────────────┤
                                         ▼
                                  COR-402 (Documentation)
```

---

## Implementation Order

### Phase 1: Cleanup & Simplification

#### 1.1 COR-422 - Strip Allowed Tools for Skills

**Effort:** Small (~1 hour)
**Dependencies:** None
**Can start:** Now

Remove experimental `allowedTools` feature from skills system:

- Comment out schema/parsing in `packages/core/src/workspace/skills/`
- Remove any UI in playground-ui
- Add TODO comments for future implementation

**Files:**

- `packages/core/src/workspace/skills/schemas.ts`
- `packages/core/src/workspace/skills/types.ts`
- `packages/playground-ui/` (if any skill tools UI)

---

#### 1.2 COR-377 - API Cleanup

**Effort:** Medium (~3-4 hours)
**Dependencies:** None (but coordinate with Caleb's COR-424)
**Can start:** Now
**Blocked by:** Should wait for COR-424 to land to avoid merge conflicts in tools.ts

Remove premature exports from workspace API:

**Confirmed Removals:**

- [ ] `snapshot()` / `restore()` + types
- [ ] `syncToSandbox()` / `syncFromSandbox()` + `SyncResult`
- [ ] `installPackage()` + `workspace_install_package` tool + types
- [ ] Sandbox filesystem methods (`writeFile`, `readFile`, `listFiles`, `getFilesystem`)
- [ ] Audit interfaces (not implemented)

**Decisions Needed:**

- `pause()` / `resume()` / `keepAlive()` - keep or remove?
- `state` getter / `WorkspaceState` - add tools or remove?
- Filesystem extras (`appendFile`, `copyFile`, `moveFile`, `rmdir`) - add tools or keep on interface only?
- `indexMany` / `unindex` / `rebuildIndex` - add tools or remove?

**Files:**

- `packages/core/src/workspace/index.ts`
- `packages/core/src/workspace/workspace.ts`
- `packages/core/src/workspace/sandbox.ts`
- `packages/core/src/workspace/local-sandbox.ts`
- `packages/core/src/workspace/filesystem.ts`
- `packages/core/src/workspace/tools.ts`

---

### Phase 2: Tool Injection Redesign

#### 2.1 COR-408 - Conditional Tool Injection API

**Effort:** Medium-Large (~4-6 hours)
**Dependencies:** COR-377 (need final tool set)
**Can start:** After COR-377 lands

Implement per-tool configuration for workspace tools:

```typescript
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './data' }),
  tools: {
    workspace_read_file: true,
    workspace_write_file: {
      enabled: true,
      requireApproval: true,
      requireReadBeforeWrite: true, // moved from filesystem safety
    },
    workspace_delete_file: false,
    workspace_execute_command: {
      enabled: true,
      requireApproval: true,
    },
  },
});
```

**Key Changes:**

1. Add `tools` config option to `WorkspaceConfig`
2. Move `requireReadBeforeWrite` from workspace.writeFile() to tool execute()
3. Move `requireApproval` from provider safety to tool config
4. Keep `readOnly` on filesystem provider (affects all callers)
5. Update `createWorkspaceTools()` to respect new config

**Safety Config Split:**
| Config | Scope | Where |
|--------|-------|-------|
| `readOnly` | All callers | Filesystem provider |
| `requireReadBeforeWrite` | Agents only | Tool config |
| `requireApproval` | Agents only | Tool config |

**Files:**

- `packages/core/src/workspace/workspace.ts`
- `packages/core/src/workspace/tools.ts`
- `packages/core/src/workspace/file-read-tracker.ts` (may move)
- Tests

**Affects:**

- COR-401 needs to know final safety config shape
- COR-402 needs to document the new API

---

### Phase 3: UI (May Defer)

#### 3.1 COR-401 - Safety Flags in Workspace UI

**Effort:** Medium (~3-4 hours)
**Dependencies:** COR-408 (need final safety config shape)
**Can start:** After COR-408 lands

**Note:** This ticket is marked [M4] - consider deferring to a later milestone if time is tight.

Reflect safety config in UI:

- Hide/disable write UI elements when `readOnly: true`
- Show approval indicators for operations that require approval

**Files:**

- `packages/server/src/server/handlers/workspace.ts` (add safety to response)
- `packages/playground-ui/src/domains/workspace/`
- `packages/playground/src/pages/workspace/`

---

### Phase 4: Documentation (Last)

#### 4.1 COR-402 - Workspace Documentation

**Effort:** Large (~6-8 hours)
**Dependencies:** All other tickets (need final API)
**Can start:** After COR-377, COR-408 land; COR-401 optional

Create documentation for the workspace module:

- [ ] README for workspace module
- [ ] Guide: Setting up workspace with agents
- [ ] Guide: Safety configuration (will change based on COR-408)
- [ ] Guide: Search and indexing
- [ ] Reference docs: Workspace API
- [ ] Reference docs: Filesystem interface
- [ ] Reference docs: Sandbox interface
- [ ] Example: Basic workspace usage

**Files:**

- `packages/core/src/workspace/README.md`
- `docs/src/content/en/docs/workspace/`
- `docs/src/content/en/reference/workspace/`

---

## Recommended Order

```
1. COR-422 (Strip allowed tools)     ← Small, independent, do first
2. COR-377 (API Cleanup)             ← After Caleb's COR-424 lands
3. COR-408 (Tool Injection API)      ← After COR-377
4. COR-401 (Safety UI)               ← After COR-408 (or defer to M4)
5. COR-402 (Documentation)           ← Last, after API is stable
```

---

## Coordination Notes

### With Caleb

- **COR-424** (In Progress) touches `tools.ts` - wait for it to land before COR-377
- **COR-397** (Todo) adds tree-style output to list_files - independent, no conflict
- **COR-427** (In Review) is skills refresh - may affect COR-422 timing

### Tickets That May Need Updates Later

- **COR-402** (Docs) - Will need updates after each ticket lands
- **COR-401** - May need description update after COR-408 changes safety config

---

## Open Questions

1. **COR-377:** What to do with `pause()`/`resume()`/`keepAlive()`?
2. **COR-377:** Keep `state` getter or remove `WorkspaceState` entirely?
3. **COR-377:** Add tools for `copyFile`/`moveFile` or leave on interface only?
4. **COR-408:** Final shape of per-tool config (boolean vs object)?
5. **COR-401:** Defer to M4 or keep in M1?

---

## Commits Strategy

Each ticket should be a separate PR:

1. **PR: COR-422** - `feat(workspace): strip experimental allowedTools from skills`
2. **PR: COR-377** - `refactor(workspace): remove premature exports from public API`
3. **PR: COR-408** - `feat(workspace): add per-tool configuration API`
4. **PR: COR-401** - `feat(playground): reflect workspace safety config in UI`
5. **PR: COR-402** - `docs(workspace): add workspace documentation`
