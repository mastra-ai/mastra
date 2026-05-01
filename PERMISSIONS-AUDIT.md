# Permissions Audit — Studio & Agent Builder

## How Permissions Work

### Three Enforcement Layers

1. **Route-level auth** (`requiresAuth: true`) — middleware rejects unauthenticated requests
2. **Route-level RBAC** (`requiresPermission` or convention-derived) — middleware checks caller has `resource:action` permission
3. **Handler-level authorship** (`resolveAuthorFilter`, `assertReadAccess`, `assertWriteAccess`) — per-record ownership checks inside the handler

Convention-derived permissions auto-generate from the route path + method:
- `GET /stored/agents` → `stored-agents:read`
- `POST /stored/agents` → `stored-agents:write`
- `DELETE /stored/agents/:id` → `stored-agents:delete`

If `requiresAuth` is `true` (or undefined and not explicitly `false`), the permission system kicks in.

---

## Server Routes

### stored-agents.ts ✅ Full authorship enforcement

| Route | Method | Path | Auth | Permission | Handler Auth |
|-------|--------|------|------|------------|-------------|
| LIST | GET | /stored/agents | ✅ | stored-agents:read | `resolveAuthorFilter` — ownership + visibility filtering |
| GET | GET | /stored/agents/:id | ✅ | stored-agents:read | `assertReadAccess` — owner or public |
| CREATE | POST | /stored/agents | ✅ | stored-agents:write | `getCallerAuthorId` — auto-sets authorId |
| UPDATE | PATCH | /stored/agents/:id | ✅ | stored-agents:write | `assertWriteAccess` — owner or admin |
| DELETE | DELETE | /stored/agents/:id | ✅ | stored-agents:delete | `assertWriteAccess` — owner or admin |
| PREVIEW | POST | /stored/agents/preview-instructions | ✅ | stored-agents:write | None |

### stored-skills.ts ✅ Full authorship enforcement

| Route | Method | Path | Auth | Permission | Handler Auth |
|-------|--------|------|------|------------|-------------|
| LIST | GET | /stored/skills | ✅ | stored-skills:read | `resolveAuthorFilter` — ownership + visibility filtering |
| GET | GET | /stored/skills/:id | ✅ | stored-skills:read | `assertReadAccess` — owner or public |
| CREATE | POST | /stored/skills | ✅ | stored-skills:write | `getCallerAuthorId` — auto-sets authorId |
| UPDATE | PATCH | /stored/skills/:id | ✅ | stored-skills:write | `assertWriteAccess` — owner or admin |
| DELETE | DELETE | /stored/skills/:id | ✅ | stored-skills:delete | `assertWriteAccess` — owner or admin |
| PUBLISH | POST | /stored/skills/:id/publish | ✅ | stored-skills:publish | `assertWriteAccess` |

### stored-agent-stars.ts ✅ Proper auth

| Route | Method | Path | Auth | Permission | Handler Auth |
|-------|--------|------|------|------------|-------------|
| STAR | POST | /stored/agents/:id/star | ✅ | stored-agents:read (explicit) | `assertReadAccess`, `getCallerAuthorId` |
| UNSTAR | DELETE | /stored/agents/:id/star | ✅ | stored-agents:read (explicit) | `assertReadAccess`, `getCallerAuthorId` |

### stored-skill-stars.ts ✅ Proper auth

| Route | Method | Path | Auth | Permission | Handler Auth |
|-------|--------|------|------|------------|-------------|
| STAR | POST | /stored/skills/:id/star | ✅ | stored-skills:read (explicit) | `assertReadAccess`, `getCallerAuthorId` |
| UNSTAR | DELETE | /stored/skills/:id/star | ✅ | stored-skills:read (explicit) | `assertReadAccess`, `getCallerAuthorId` |

### stored-workspaces.ts ⚠️ NO authorship enforcement

| Route | Method | Path | Auth | Permission | Handler Auth |
|-------|--------|------|------|------------|-------------|
| LIST | GET | /stored/workspaces | ✅ | stored-workspaces:read | **None** — no ownership filter |
| GET | GET | /stored/workspaces/:id | ✅ | stored-workspaces:read | **None** |
| CREATE | POST | /stored/workspaces | ✅ | stored-workspaces:write | **None** — authorId from body, not injected |
| UPDATE | PATCH | /stored/workspaces/:id | ✅ | stored-workspaces:write | **None** — anyone can update any workspace |
| DELETE | DELETE | /stored/workspaces/:id | ✅ | stored-workspaces:delete | **None** — anyone can delete any workspace |

**Notes:** Workspaces are created by the system on startup (`ensureBuilderWorkspaces`) with no authorId. They have no `visibility` field. The `authorId` field exists in the schema but is never populated by the builder. Question: should workspaces be admin-only shared resources, or per-user?

### stored-mcp-clients.ts ⚠️ NO authorship enforcement

| Route | Method | Path | Auth | Permission | Handler Auth |
|-------|--------|------|------|------------|-------------|
| LIST | GET | /stored/mcp-clients | ✅ | stored-mcp-clients:read | **None** |
| GET | GET | /stored/mcp-clients/:id | ✅ | stored-mcp-clients:read | **None** |
| CREATE | POST | /stored/mcp-clients | ✅ | stored-mcp-clients:write | **None** |
| UPDATE | PATCH | /stored/mcp-clients/:id | ✅ | stored-mcp-clients:write | **None** |
| DELETE | DELETE | /stored/mcp-clients/:id | ✅ | stored-mcp-clients:delete | **None** |

### stored-mcp-servers.ts ⚠️ NO authorship enforcement

Same pattern as mcp-clients — `requiresAuth: true`, convention-derived permissions, no handler-level checks.

### stored-prompt-blocks.ts ⚠️ NO authorship enforcement

Same pattern — all CRUD routes have `requiresAuth: true`, convention-derived permissions, no handler-level ownership checks.

### stored-scorers.ts ⚠️ NO authorship enforcement

Same pattern.

### workspace.ts ✅ Fixed — `requiresAuth: true` added to all 21 routes

Previously none set `requiresAuth` (relied on global `/api/*` path matching). Now all 21 routes explicitly require auth. Convention-derived permissions: `workspaces:read` (GET), `workspaces:write` (POST), `workspaces:delete` (DELETE).

| Route | Method | Path | Auth | Derived Permission |
|-------|--------|------|------|-------------------|
| LIST_WORKSPACES | GET | /workspaces | ✅ | workspaces:read |
| GET_WORKSPACE | GET | /workspaces/:id | ✅ | workspaces:read |
| FS_READ | GET | /workspaces/:id/fs/read | ✅ | workspaces:read |
| FS_WRITE | POST | /workspaces/:id/fs/write | ✅ | workspaces:write |
| FS_DELETE | DELETE | /workspaces/:id/fs/delete | ✅ | workspaces:delete |
| FS_LIST | GET | /workspaces/:id/fs/list | ✅ | workspaces:read |
| FS_MKDIR | POST | /workspaces/:id/fs/mkdir | ✅ | workspaces:write |
| FS_STAT | GET | /workspaces/:id/fs/stat | ✅ | workspaces:read |
| SEARCH | GET | /workspaces/:id/search | ✅ | workspaces:read |
| INDEX | POST | /workspaces/:id/index | ✅ | workspaces:write |
| LIST_SKILLS | GET | /workspaces/:id/skills | ✅ | workspaces:read |
| GET_SKILL | GET | /workspaces/:id/skills/:name | ✅ | workspaces:read |
| *...9 more skill/skills.sh routes* | | | ✅ | workspaces:read/write |

No handler-level authorship checks — workspace resources are system-managed, not user-owned.

### agents.ts — Mixed

| Route | Method | Path | Auth | Permission | Handler Auth |
|-------|--------|------|------|------------|-------------|
| LIST | GET | /agents | ✅ | agents:read (explicit) | `resolveAuthorFilter` |
| GET | GET | /agents/:id | ✅ | agents:read (explicit) | `assertStoredAgentReadAccess` |
| GENERATE | POST | /agents/:id/generate | ✅ | agents:execute (explicit) | `assertStoredAgentExecuteAccess` |
| STREAM | POST | /agents/:id/stream | ✅ | agents:execute (explicit) | `assertStoredAgentExecuteAccess` |
| UPDATE_MODEL | PATCH | /agents/:id/model | ✅ | agents:write (derived) | `assertStoredAgentWriteAccess` |
| CLONE | POST | /agents/:id/clone | ✅ | agents:execute (derived) | `assertStoredAgentReadAccess`, `getCallerAuthorId` |
| GET_SKILL | GET | /agents/:id/skills/:name | ✅ | agents:read (derived) | `assertStoredAgentReadAccess` |

**Fixed:** `GET_AGENT_SKILL_ROUTE` now has `requiresAuth: true`.

### conversations.ts ✅ All explicit permissions

| Route | Auth | Permission |
|-------|------|------------|
| CREATE | ✅ | agents:create |
| GET | ✅ | agents:read |
| GET_ITEMS | ✅ | agents:read |
| DELETE | ✅ | agents:delete |

### responses.ts ✅ All explicit permissions

| Route | Auth | Permission |
|-------|------|------------|
| CREATE | ✅ | agents:execute |
| LIST | ✅ | agents:read |
| DELETE | ✅ | agents:delete |

### auth.ts — Public + 1 protected

| Route | Auth | Notes |
|-------|------|-------|
| 7 auth routes | ❌ (public) | Login, callback, refresh, etc. |
| GET_ROLE_PERMISSIONS | ✅ | Manual admin check in handler |

### editor-builder.ts

| Route | Auth | Permission |
|-------|------|------------|
| GET_SETTINGS | ✅ | agents:read (explicit) |

### Other handlers (workflows, tools, memory, mcp, voice, vector, datasets, scores, observability, logs)

All have `requiresAuth: true`, convention-derived permissions, no handler-level authorship checks. These are code-defined resources, not user-created content, so ownership doesn't apply.

---

## Client-Side Permission Checks

### Layout-Level Gates

| Layer | File | What it does |
|-------|------|-------------|
| Auth gate | `components/layout.tsx` | `<AuthRequired>` — shows login if unauthenticated |
| Route RBAC | `App.tsx` | `<RoutePermissionGuard>` — checks pathname against route-permissions registry, redirects if denied |
| Builder gate | `agent-builder/layout/agent-builder-root-layout.tsx` | `useBuilderAgentAccess()` — requires `agents:read` + `stored-agents:write`. Shows "Access Denied" or redirects to `/login` |

### Route Permission Registry

`packages/playground/src/domains/auth/route-permissions.ts` maps routes to required permissions:

| Route Pattern | Required Permission |
|---------------|-------------------|
| `/agents` | `agents:read` |
| `/workflows` | `workflows:read` |
| `/tools` | `tools:read` |
| `/mcp` | `mcp:read` |
| `/logs` | `observability:read` |
| `/traces` | `observability:read` |
| `/scorers` | `scores:read` |
| `/evaluation` | `scores:read` |
| `/experiments` | `scores:read` |
| `/datasets` | `datasets:read` |
| `/agent-builder` | `stored-agents:read` |
| `/settings` | public |
| `/request-context` | public |

### Sidebar Gating

`components/ui/app-sidebar.tsx` — `filterSidebarLink()` hides nav items when RBAC is enabled and user lacks the route's required permission.

### Per-Page Error Handling

~35 page components handle API errors with:
- `is401UnauthorizedError` → `<SessionExpired />`
- `is403ForbiddenError` → `<PermissionDenied resource="..." />`

### Component-Level Checks

| Component | Check | Effect |
|-----------|-------|--------|
| `AgentToolPanel` | `canExecute('tools')` | Shows "no permission" text |
| `ToolPanel` | `canExecute('tools')` | Shows "no permission" text |
| `MCPToolPanel` | `canExecute('tools')` | Shows "no permission" text |
| `agent-settings` | `canEdit('agents')` | Disables all controls |
| `chat-threads` | `canDelete('memory')` | Hides delete button |
| `workflow-run-list` | `canDelete('workflows')` | Hides delete button |
| `workflow-trigger` | `canExecute('workflows')` | Hides trigger form |

### isAdmin Checks

Files checking `permissions?.includes('*')`:
- `favorite/index.tsx` — passes `isAdmin` to `SkillEditDialog`
- `library/index.tsx` — same
- `skills/index.tsx` — same
- `skill-edit-dialog.tsx` — shows/hides "Advanced mode" toggle (file tree editor)

### Feature Flags (not RBAC)

`features.*` from `useBuilderSettings()` gate builder capabilities:
`features.tools`, `features.skills`, `features.model`, `features.avatarUpload`, `features.browser`, `features.stars`, `features.agents`, `features.workflows`

---

## How `requiresAuth` Works

Understanding the auth flow is essential for interpreting this audit:

1. **`requiresAuth: true`** — Forces authentication even on public-pattern paths. Permission derived from convention (or explicit `requiresPermission`).
2. **`requiresAuth: false`** — Explicitly public. No auth, no permission check.
3. **`requiresAuth: undefined`** (omitted) — Auth still runs via global path matching (`protected: ['/api/*']`). So routes under `/api/*` are still authenticated. However, omitting `requiresAuth` means:
   - The route isn't explicitly documented as needing auth
   - If someone changes the `protected` patterns, these routes silently become unprotected
   - It's a gap in **explicitness**, not necessarily a runtime vulnerability

**Permission derivation** (when RBAC is configured):
- `GET /workspaces/:id` → `workspaces:read`
- `POST /workspaces/:id/fs/write` → `workspaces:write`
- `DELETE /workspaces/:id/fs/delete` → `workspaces:delete`
- `POST /agents/:id/stream` → `agents:execute` (contains `/stream`)
- `stored:*` expands to `stored-agents:*`, `stored-skills:*`, `stored-workspaces:*`, etc.

---

## Fixes Applied

### ✅ Fixed: workspace.ts — added `requiresAuth: true` to all 21 routes

Previously omitted (relied on global path matching). Now explicit.

### ✅ Fixed: GET_AGENT_SKILL_ROUTE — added `requiresAuth: true`

The only `agents.ts` route that was missing it.

---

## Remaining Gaps

### 🟡 Medium: stored-workspaces has no ownership model

- `authorId` field exists but is never auto-populated
- No `resolveAuthorFilter` on LIST
- No `assertWriteAccess` on UPDATE/DELETE
- Anyone with `stored-workspaces:write` can modify/delete any workspace
- Builder-created workspaces have no owner (system resources)
- **Open question:** Should workspaces be admin-only shared resources? They're typically created by the system on startup and shared across all users.

### 🟡 Medium: stored-mcp-clients, stored-prompt-blocks, stored-scorers have no ownership

Same gap as workspaces — `requiresAuth` gates route access, but no per-record ownership. Anyone with write permission can modify/delete any record.

- MCP clients may be shared infrastructure (like workspaces)
- Prompt blocks and scorers might benefit from ownership if users create their own

### 🟢 Low: Convention-derived vs explicit permissions

Most routes rely on convention-derived permissions rather than explicit `requiresPermission`. This works but makes the permission model implicit. Only `agents.ts`, `conversations.ts`, `responses.ts`, `editor-builder.ts`, star routes, and `observability-shared.ts` use explicit permissions.

---

## Agent Builder Permission Analysis

The Agent Builder UI makes API calls across many resource families. Here's every endpoint it touches, and whether the current member role covers it.

### Member Role: `['stored-agents:*', 'agents:*', 'stored-skills:*']`

#### Stored Agents — ✅ All covered by `stored-agents:*`

| Endpoint | Method | Derived Permission |
|----------|--------|-------------------|
| `/stored/agents` | GET | `stored-agents:read` |
| `/stored/agents` | POST | `stored-agents:write` |
| `/stored/agents/:id` | GET | `stored-agents:read` |
| `/stored/agents/:id` | PATCH | `stored-agents:write` |
| `/stored/agents/:id` | DELETE | `stored-agents:delete` |
| `/stored/agents/preview-instructions` | POST | `stored-agents:write` |
| `/stored/agents/:id/star` | PUT/DELETE | `stored-agents:read` (explicit) |

#### Runtime Agents — ✅ All covered by `agents:*`

| Endpoint | Method | Derived Permission | Used For |
|----------|--------|-------------------|----------|
| `/agents` | GET | `agents:read` (explicit) | Populates runtime agent list for builder tool dropdown |
| `/agents/providers` | GET | `agents:read` (derived) | LLM model selection in chat |
| `/agents/:id/stream` | POST | `agents:execute` (explicit) | Chat with builder-agent or stored agent |
| `/agents/:id/skills/:name` | GET | `agents:read` (derived) | View agent skill details |

#### Stored Skills — ✅ All covered by `stored-skills:*`

| Endpoint | Method | Derived Permission |
|----------|--------|-------------------|
| `/stored/skills` | GET | `stored-skills:read` |
| `/stored/skills` | POST | `stored-skills:write` |
| `/stored/skills/:id` | GET | `stored-skills:read` |
| `/stored/skills/:id` | PATCH | `stored-skills:write` |
| `/stored/skills/:id/star` | PUT/DELETE | `stored-skills:read` (explicit) |

#### Builder Settings — ✅ Covered by `agents:*`

| Endpoint | Method | Permission |
|----------|--------|-----------|
| `/editor/builder/settings` | GET | `agents:read` (explicit) |

#### Stored Workspaces — ❌ NOT covered

| Endpoint | Method | Derived Permission | Used For |
|----------|--------|-------------------|----------|
| `/stored/workspaces` | GET | `stored-workspaces:read` | Workspace dropdown in agent edit + skill edit |

**Impact:** Member cannot load workspace dropdown → can't see or pick workspaces when editing agents/skills. The form still works (workspace ID is a hidden field loaded from existing data), but creates without a workspace dropdown.

#### Runtime Workspaces — ❌ NOT covered

| Endpoint | Method | Derived Permission | Used For |
|----------|--------|-------------------|----------|
| `/workspaces/:id/fs/read` | GET | `workspaces:read` | Read skill files |
| `/workspaces/:id/fs/write` | POST | `workspaces:write` | Write skill files on create/update |
| `/workspaces/:id/fs/list` | GET | `workspaces:read` | Browse file tree in advanced skill editor |
| `/workspaces/:id/fs/delete` | DELETE | `workspaces:delete` | Delete skill files |
| `/workspaces/:id/fs/mkdir` | POST | `workspaces:write` | Create directories |
| `/workspaces/:id/fs/stat` | GET | `workspaces:read` | Check file existence |
| `/workspaces/:id/search` | GET | `workspaces:read` | Search workspace content |
| `/workspaces/:id/index` | POST | `workspaces:write` | Index workspace content |
| `/workspaces/:id/skills` | GET | `workspaces:read` | List discovered skills |
| `/workspaces/:id/skills/:name` | GET | `workspaces:read` | Get skill details from filesystem |
| `/workspaces/:id/skills/:name/references` | GET | `workspaces:read` | List skill references |
| `/workspaces/:id/skills/:name/references/:path` | GET | `workspaces:read` | Get reference file content |
| `/workspaces/:id/skills/search` | POST | `workspaces:write` | Search workspace skills |
| `/workspaces/:id/skills-sh/*` | GET/POST | `workspaces:read/write` | skills.sh marketplace integration |

**Impact:** Member cannot read/write skill files to workspace filesystem. Skills can be created as DB-only records, but file-tree persistence (advanced mode) and skills.sh integration are broken.

#### Memory (Conversation History) — ❌ NOT covered

| Endpoint | Method | Derived Permission | Used For |
|----------|--------|-------------------|----------|
| `/memory/threads/:id/messages` | GET | `memory:read` | Load builder chat history + agent chat history |

**Impact:** Chat history doesn't load. The builder chat and agent chat panels show empty conversation. New messages still stream (via `agents:execute`), but refreshing the page loses history.

#### Tools & Workflows — ❌ NOT covered

| Endpoint | Method | Derived Permission | Used For |
|----------|--------|-------------------|----------|
| `/tools` | GET | `tools:read` | List available tools for agent config |
| `/workflows` | GET | `workflows:read` | List available workflows for agent config |

**Impact:** Agent edit page can't populate the tools/workflows lists. The agent configuration dropdowns for tools and workflows will be empty or error.

### Recommended Member Permissions

```typescript
member: [
  // Agent Builder core
  'stored-agents:*',    // CRUD stored agents
  'agents:*',           // Runtime agents: list, chat, execute, create conversations
  'stored-skills:*',    // CRUD stored skills

  // Workspace access (needed for skill file I/O)
  'stored-workspaces:read',  // List workspaces in dropdown (read-only — workspaces are system resources)
  'workspaces:read',         // Read skill files, browse file tree
  'workspaces:write',        // Write skill files, create directories

  // Supporting resources (read-only for agent configuration)
  'tools:read',              // List available tools for agent config
  'workflows:read',          // List available workflows for agent config
  'memory:read',             // Load conversation history in builder/agent chat
]
```

**Why not `workspaces:*`?** Members shouldn't delete workspace files or workspaces themselves. Read + write is sufficient for skill file I/O.

**Why not `stored-workspaces:write`?** Workspaces are system-managed resources created by the builder on startup. Members should be able to see them but not modify DB records.

**Why not `memory:write`?** The builder agent writes messages via `agents:execute` (streaming), which handles persistence internally. Members don't need direct memory write access.

### Shorthand Alternative

Using the `stored:` compound expansion:

```typescript
member: [
  'stored:*',          // All stored-* families (agents, skills, workspaces, mcp-clients, etc.)
  'agents:*',          // Runtime agents
  'workspaces:read',   // Read workspace files
  'workspaces:write',  // Write workspace files
  'tools:read',        // List tools
  'workflows:read',    // List workflows
  'memory:read',       // Conversation history
]
```

**Trade-off:** `stored:*` also grants access to `stored-mcp-clients`, `stored-prompt-blocks`, `stored-scorers`. These have no ownership model, so any member could modify anyone's records.

---

## Example Roles (from example app)

| Role | Permissions | Access |
|------|------------|--------|
| admin | `*` | Everything + ownership bypass |
| superadmin | `*` | Same as admin |
| member | `stored-agents:*`, `agents:*`, `stored-skills:*` | Agents + skills only (⚠️ missing workspace/tools/memory) |
| operator | `agents:read`, `agents:execute`, `tools:read`, `workflows:read` | View + run agents |
| viewer | *(none)* | Nothing (all routes denied) |
| auditor | `observability:read`, `logs:read` | Observability only |
