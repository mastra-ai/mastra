# Agent Builder — Engineering Spec

Branch: `agent-builder`
Status: shipped on-branch (EE-gated, additive; no data migrations)
Owners: Studio / Agent Builder
License: Mastra Enterprise (all source under `ee/` directories)

---

## 1. Goals

Agent Builder is an **end-user surface in Mastra Studio** that lets non-engineers (members of a team) author, share, and collaborate on agents without touching source code. It reuses the existing Studio CMS and storage primitives and layers five new capabilities on top:

1. **Agent Studio shell** — a simplified, end-user sidebar (Agents / Projects / Library / Configure) that coexists with the existing admin Studio shell.
2. **Stored agents with identity** — `authorId`, `visibility`, avatar, and a thin `metadata` bag so members can own agents and publish them to a team-wide Library.
3. **Per-user preferences** — starred agents/skills, appearance, view state; stored server-side so they survive devices.
4. **Projects** — a stored agent of `role: 'supervisor'` that invites sub-agents, exposes five built-in `project_*` tools, and renders a collaborative chat workspace with a task panel and `@mention` routing.
5. **EE gating** — a configurable `agentBuilder` on the `Mastra` class (`@mastra/studio-agent-builder`) that turns the surface on and shapes what end-users see.

Non-goals (explicitly out of scope for this branch):

- A brand-new storage adapter. Everything is additive on top of `agents`, `skills`, and a new `user-preferences` domain.
- Breaking the admin/CMS flows. `/cms/agents/...` is unchanged and remains the engineering surface.
- A new RBAC resource. We reuse `stored-agents:*` and `stored-skills:*` permissions.

---

## 2. Entry points & URL map

All end-user routes live under `/agent-studio`. The admin CMS routes under `/cms` are untouched.

```
/                                   → <StudioIndexRedirect> (→ /agent-studio/agents for members, /agents for admins)
/agent-studio/agents                list (scope: mine | all | team)
/agent-studio/agents/create         create (simplified CMS form + avatar picker)
/agent-studio/agents/:id/edit       edit (simplified CMS form, owner-gated)
/agent-studio/agents/:id/chat       chat session (AgentLayout + memory threads + edit button)
/agent-studio/agents/:id/chat/:threadId

/agent-studio/projects              list
/agent-studio/projects/create       create (name, description, instructions, model, invite agents)
/agent-studio/projects/:id/edit     edit (redirects to agent edit of the supervisor)
/agent-studio/projects/:id/chat     project workspace (leftSlot: threads, rightSlot: tasks)
/agent-studio/projects/:id/chat/:threadId

/agent-studio/library/agents        public agents authored by others
/agent-studio/library/skills        public skills authored by others
/agent-studio/library/skills/:id    skill detail

/agent-studio/configure             entry: skills + appearance + studio config
/agent-studio/configure/skills      list (author-scoped)
/agent-studio/configure/skills/create
/agent-studio/configure/skills/:id/edit
/agent-studio/configure/appearance  theme
```

---

## 3. Architecture overview

```
┌──────────────────────────────────────────────┐
│  @mastra/studio-agent-builder  (EE package)  │   ← config holder, license gate
│  ee/src/{agent-builder,license,index}.ts     │
└───────────────┬──────────────────────────────┘
                │ implements IMastraAgentBuilder
                ▼
┌──────────────────────────────────────────────┐
│  @mastra/core                                 │
│  - mastra.agentBuilder                        │   ← attached instance
│  - agent-builder/ee/types.ts                  │   ← config contracts
│  - agent-builder/ee/tools/*                   │   ← 5 built-in project tools
│  - storage/types.ts                           │   ← role, metadata, visibility
│  - storage/domains/user-preferences           │   ← new domain
└───────────────┬──────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│  @mastra/server                                │
│  - EE license gate (agent-builder feature)    │
│  - /projects, /user/preferences,              │
│    /auth/users/lookup, avatar upload routes    │
│  - project tools auto-merged into registered  │
│    tools when agentBuilder is configured       │
└───────────────┬──────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│  @mastra/client-js                             │
│  - project, preferences, avatar, user-lookup  │
└───────────────┬──────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│  @mastra/playground                            │
│  - /agent-studio/** pages                     │
│  - agent-studio sidebar + hooks + components  │
└──────────────────────────────────────────────┘
```

### Licensing

- All source that implements the Agent Builder lives under `ee/` directories and is governed by `ee/LICENSE` (Mastra Enterprise License). `LICENSE.md` at the repo root enumerates the `ee/` dirs.
- Runtime validation in `@mastra/core/src/auth/ee/license.ts` checks `MASTRA_EE_LICENSE` (or dev env) and exposes `isFeatureEnabled('agent-builder')`.
- `@mastra/server` validates the license at init when `mastra.agentBuilder` is configured. The server does **not** 404 the routes; the feature is simply inert if `agentBuilder` is not attached.

---

## 4. Configuration contract

`MastraAgentBuilderConfig` is the only user-facing knob. It is passed to `new MastraAgentBuilder({...})` from `@mastra/studio-agent-builder` and attached via `new Mastra({ agentBuilder })`.

```ts
interface MastraAgentBuilderConfig {
  enabledSections?: ('tools' | 'agents' | 'workflows' | 'scorers' | 'skills' | 'memory' | 'variables')[];
  marketplace?: {
    enabled?: boolean;
    showAgents?: boolean;
    showSkills?: boolean;
    allowStarring?: boolean;
    allowSharing?: boolean;
  };
  configure?: {
    allowSkillCreation?: boolean;
    allowAppearance?: boolean;
    allowAvatarUpload?: boolean;
  };
  recents?: { maxItems?: number };
  defaultMemoryConfig?: Record<string, unknown>; // SerializedMemoryConfig
}
```

The resolved (non-optional) variants are exposed to the UI via `GET /system/packages`:

```json
{
  "agentBuilderEnabled": true,
  "agentBuilderConfig": {
    "enabledSections": [...],
    "marketplace": { "enabled": true, ... },
    "configure": { ... },
    "recents": { "maxItems": 10 },
    "hasDefaultMemoryConfig": true
  }
}
```

`hasDefaultMemoryConfig` is intentionally a boolean — the actual config is server-side and is applied to `CREATE_STORED_AGENT_ROUTE` and `CREATE_PROJECT_ROUTE` when the payload does not include a `memory` field. When `true`, the CMS Memory tab is hidden.

---

## 5. Data model

### 5.1 `StorageAgentType` (thin record) — additive fields

```ts
interface StorageAgentType {
  id: string;
  status: 'draft' | 'published' | 'archived';
  activeVersionId?: string;
  authorId?: string; // multi-tenant filter
  role?: 'agent' | 'supervisor'; // NEW — projects are supervisors
  metadata?: Record<string, unknown>; // NEW — thin-record bag
  createdAt: Date;
  updatedAt: Date;
}
```

The `agent-builder` storage convention under `metadata`:

```ts
metadata.visibility   : 'private' | 'public'   // VisibilityValue
metadata.avatarUrl    : string                  // data URL (≤ 512KB after 256×256 downscale)
metadata.project      : ProjectMetadata         // only on role === 'supervisor'
```

### 5.2 `ProjectMetadata`

```ts
interface ProjectTask {
  id: string;
  title: string;
  description?: string;
  assigneeAgentId?: string;
  status: 'open' | 'in_progress' | 'done' | 'blocked';
  createdAt: string;
  updatedAt: string;
}

interface ProjectMetadata {
  isProject: true;
  tasks: ProjectTask[];
  invitedAgentIds: string[];
  invitedSkillIds: string[];
}
```

Projects are identified in the server layer as:

```
record.role === 'supervisor' || record.metadata?.project?.isProject === true
```

The `isProject` fallback lets LibSQL work without a `role` column migration — `metadata` is already persisted as jsonb on the thin record.

### 5.3 `StorageSkillType` — added thin-record `metadata`

Same pattern as agents. Skills can now carry `visibility` and any forward-compatible extensions without a version bump. **LibSQL skill adapter currently keeps `metadata` in the snapshot path** — that's a known limitation called out in §10.

### 5.4 `user-preferences` storage domain (new)

```ts
interface StorageUserPreferencesAgentStudio {
  starredAgents?: string[];
  starredSkills?: string[];
  previewMode?: boolean; // admin → end-user preview
  appearance?: 'light' | 'dark';
  agentsView?: 'grid' | 'list';
  agentsScope?: 'all' | 'mine' | 'team';
}

interface StorageUserPreferencesType {
  userId: string; // primary key
  agentStudio: StorageUserPreferencesAgentStudio;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

- Non-versioned, keyed by `userId`, no `list`.
- Implementations: `inmemory`, `filesystem`. `libsql` is not required on this branch (preferences gracefully degrade when the user is unauthenticated).
- `update` is a deep-merge on `agentStudio`, shallow-merge on `metadata`.

---

## 6. Server API surface

All routes register through `packages/server/src/server/server-adapter/routes/index.ts`. No new RBAC resource; reuses `stored-agents:read|write|delete` and `stored-skills:read|write|delete`.

### 6.1 Projects (`/projects`)

| Method   | Path                                         | Permission             | Notes                                                                                                                                                                                        |
| -------- | -------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/projects`                                  | `stored-agents:write`  | Creates a `role: 'supervisor'` stored agent with `metadata.project` seeded and the 5 `project_*` tool keys pre-registered. Applies `defaultMemoryConfig` if unset. Auto-publishes version 1. |
| `GET`    | `/projects`                                  | `stored-agents:read`   | Lists supervisor records (author-scoped).                                                                                                                                                    |
| `GET`    | `/projects/:projectId`                       | `stored-agents:read`   | 404 if record is not a supervisor.                                                                                                                                                           |
| `PATCH`  | `/projects/:projectId`                       | `stored-agents:write`  | Uses `handleAutoVersioning` + auto-activate. Owner-gated.                                                                                                                                    |
| `DELETE` | `/projects/:projectId`                       | `stored-agents:delete` | Owner-gated.                                                                                                                                                                                 |
| `POST`   | `/projects/:projectId/invite-agent`          | `stored-agents:write`  | Appends to `metadata.project.invitedAgentIds` + supervisor `agents` snapshot; auto-stars for caller via user-preferences.                                                                    |
| `DELETE` | `/projects/:projectId/invite-agent/:agentId` | `stored-agents:write`  | —                                                                                                                                                                                            |
| `POST`   | `/projects/:projectId/tasks`                 | `stored-agents:write`  | —                                                                                                                                                                                            |
| `PATCH`  | `/projects/:projectId/tasks/:taskId`         | `stored-agents:write`  | —                                                                                                                                                                                            |
| `DELETE` | `/projects/:projectId/tasks/:taskId`         | `stored-agents:write`  | —                                                                                                                                                                                            |

### 6.2 User preferences (`/user/preferences`)

| Method  | Path                | Auth     | Notes                                                       |
| ------- | ------------------- | -------- | ----------------------------------------------------------- |
| `GET`   | `/user/preferences` | Required | Returns defaults if no row exists. 401 if no auth provider. |
| `PATCH` | `/user/preferences` | Required | Deep-merge on `agentStudio`.                                |

### 6.3 Avatar upload

| Method | Path                                   | Permission            | Notes                                                                 |
| ------ | -------------------------------------- | --------------------- | --------------------------------------------------------------------- |
| `POST` | `/stored/agents/:storedAgentId/avatar` | `stored-agents:write` | Base64 data URL body; persisted at `metadata.avatarUrl`. Owner-gated. |

### 6.4 User lookup (`/auth/users/lookup`)

| Method | Path                 | Notes                                                                                                                                                                                                                             |
| ------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/auth/users/lookup` | Batched: body `{ ids: string[] }`; returns `{ [id]: { id, name?, email?, avatarUrl? } }`. Uses `IUserProvider.getUser(id)` when available. Used by Agent Studio cards to resolve `authorId` → display name across auth providers. |

### 6.5 Ownership guard

`UPDATE_STORED_AGENT_ROUTE`, `DELETE_STORED_AGENT_ROUTE`, and `UPLOAD_STORED_AGENT_AVATAR_ROUTE` share an `assertAgentOwnership` helper:

- Skip when the server has no auth provider or the record has no `authorId` (open-dev ergonomics).
- Otherwise `403` when `caller.id !== record.authorId`.

### 6.6 Project tool registration

`GET_TOOL_BY_ID_ROUTE` and `EXECUTE_TOOL_ROUTE` merge the five `project_*` tools from `getProjectTools()` into the `registeredTools` map when `mastra.agentBuilder` is configured. This is how a supervisor's `tools` config resolves at runtime without the consumer having to register anything.

---

## 7. Built-in project tools

Defined in `packages/core/src/agent-builder/ee/tools/index.ts`. They all accept an optional `projectId` arg; otherwise resolved from `requestContext.projectId`.

| Tool ID                      | Purpose                                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project_add_task`           | Append a `ProjectTask` under `metadata.project.tasks`.                                                                                                   |
| `project_update_task`        | Partial update on a task (title/description/status/assignee).                                                                                            |
| `project_list_tasks`         | Read-only listing for the supervisor's own reasoning.                                                                                                    |
| `project_search_marketplace` | Search `visibility: 'public'` agents + skills (via `listResolved`).                                                                                      |
| `project_propose_agent`      | Emit a structured payload the UI renders as an approval card. Accepting the proposal calls `POST /projects/:projectId/invite-agent` and stars the agent. |

All five tools use `MastraUnion` via `context.mastra` to reach storage, and are stateless otherwise. They write with the same `handleAutoVersioning` pattern used by `/projects` update so task mutations are reflected immediately on the thin record.

---

## 8. Playground UI surface

### 8.1 Shell gating (`useShouldShowAgentStudio`)

```
isAdmin         = hasPermission('stored-agents:write') && !previewMode
shouldShowStudio = !isAdmin && agentBuilderEnabled
```

The admin's preview toggle flips `agentStudio.previewMode` in user-preferences so they can see the end-user shell without losing admin permissions.

### 8.2 Sidebar (`agent-studio-sidebar.tsx`)

Flat, four top-level links: **Agents**, **Projects**, **Library**, **Configure**. `Settings` appears only for admins. No section breaks. `MastraVersionFooter` is not rendered.

### 8.3 Create / Edit agent forms

- Both routes render `AgentCmsFormShell` directly — **no** redirect to `/cms/...`.
- `AgentCmsFormShell` accepts `simplifiedSections`, `basePath`, `redirectOnSuccess`.
- `simplifiedSections: true` is passed by Agent Studio create + edit pages. This trims the sidebar to Identity / Instructions / Tools / Skills / Variables. The admin `/cms/agents/...` routes keep the full sidebar.
- `Memory` is additionally hidden whenever `agentBuilderConfig.hasDefaultMemoryConfig === true`.
- Create page wires a `PendingAvatarProvider` and a `useAgentCmsForm.onAfterCreate(agentId)` callback that uploads the pending avatar (base64, downscaled to 256×256) before navigating to `/agent-studio/agents/:id/chat`.
- Edit page redirects non-authors to `/agent-studio/agents/:id/chat` (server returns 403 as a hard guarantee; client just avoids the round-trip).

### 8.4 Chat view (`agents/chat.tsx`)

- `AgentLayout` with `leftSlot = <AgentSidebar>` (memory threads) and a header containing `AgentAvatar`, agent name, `VisibilityBadge`, and an "Edit agent" button (gated by `canEdit`).
- Reuses `ChatThreads` / `AgentSidebar`, which now accept `newThreadUrl` / `threadUrl` props so thread links stay inside `/agent-studio`.
- Redundant logo/auth chrome removed — the Studio shell already provides them.

### 8.5 Project workspace (`projects/chat.tsx`)

- Same `AgentLayout`, but `rightSlot = <ProjectTasksPanel>`.
- Supervisor is the active agent. `useProject(projectId)` drives member avatars in the header and the task panel.
- `tool-fallback.tsx` invalidates the `['project']` query whenever a `project_*` tool completes, so background task mutations surface immediately.
- `Composer` supports `@mention` autocomplete that injects `[[agent:<id>]]` tokens; tokens are forwarded to the supervisor as `requestContext.mentionedAgentIds`. Routing is **advisory** — the supervisor's system prompt is seeded with "When the user mentions an agent with @, call only that agent's delegate tool."
- `project_propose_agent` output renders as an approval card. Accept → `inviteAgentToProject` + star.

### 8.6 Agents list filtering (`useStudioAgents`)

| Scope  | Behavior                                                  |
| ------ | --------------------------------------------------------- |
| `mine` | All agents where `authorId === user.id`, any visibility.  |
| `team` | `authorId !== user.id` **and** `visibility === 'public'`. |
| `all`  | `authorId === user.id` OR `visibility === 'public'`.      |

Private agents authored by others are never visible client-side. Server-side ownership guards protect the write paths.

### 8.7 Author display

`useUserLookup` batches missing author IDs, calls `POST /auth/users/lookup`, and caches by `userId`. `AgentStudioCard` / `SkillStudioCard` accept an `authorDisplayName` prop so the grid resolves names lazily without N+1 lookups. Falls back to "Unknown author" when the provider has no record.

### 8.8 Star / visibility primitives

- `visibility.ts` + `avatar.ts` hold pure helpers; the React components (`VisibilityBadge`, `AgentAvatar`) are separated from helpers so `react-refresh` is happy.
- `StarButton` calls `useToggleStar`, which is a no-op when `!isAuthenticated`.
- `AgentSharingPanel` / `SkillSharingPanel` toggle visibility and (agents only) upload avatars. Shown only in edit mode.

---

## 9. Feature detection & rollout

- `GET /system/packages` advertises `agentBuilderEnabled: boolean` and `agentBuilderConfig`. The UI gates on these; no build flag.
- `MASTRA_EXPERIMENTAL_UI` is the legacy opt-in for the existing experimental Studio. Agent Studio respects it for compat but does not require it.
- The EE license gate kicks in at server init when `mastra.agentBuilder` is present. Without a license, the server throws during startup (matches RBAC pattern). There is no partial-on state.

---

## 10. Known limitations / follow-ups

1. **LibSQL skill adapter** — writes thin-record `metadata` into the snapshot path. Updating skill metadata with no config change produces `undefined` column values. Worked around on the branch by gating skill visibility UI behind the agent flow where possible; a proper fix is a follow-up in `stores/libsql`.
2. **`@mention` routing is advisory.** Supervisors occasionally paraphrase instead of routing. The system prompt mitigates but does not prevent this.
3. **Avatars are base64 data URLs** stored on `metadata.avatarUrl`. Acceptable at ≤ 512KB after client-side downscaling; migrate to object storage when the footprint becomes a concern.
4. **Preferences require auth.** Without an auth provider, starring is a client-only no-op and the `/user/preferences` routes return 401 (the UI degrades to safe defaults).
5. **No `projects:*` RBAC resource.** We chose to reuse `stored-agents:*` to avoid a permissions migration. Revisit if project-specific permissions become necessary.

---

## 11. Testing

### Unit / handler tests

- `packages/core/src/storage/domains/agents/*.test.ts` — persist + filter by `role`.
- `packages/core/src/storage/domains/skills/inmemory.test.ts` — metadata merge.
- `packages/core/src/storage/domains/user-preferences/{inmemory,filesystem}.test.ts` — CRUD + init.
- `packages/core/src/agent-builder/ee/tools/index.test.ts` — 5 project tools.
- `packages/server/src/server/handlers/projects.test.ts` — project CRUD + invite + tasks.
- `packages/server/src/server/handlers/user-preferences.test.ts` — auth gating + merge.
- `packages/server/src/server/handlers/stored-agents-avatar.test.ts` — base64 round-trip.
- `packages/server/src/server/handlers/stored-agents-ownership.test.ts` — 403 / skip / allow matrix.
- `packages/server/src/server/handlers/system.test.ts` — `agentBuilderConfig` shape.

### Playwright E2E (`packages/playground/e2e/tests/agent-studio/`)

- `sidebar.spec.ts` — flat sidebar + member visibility.
- `agent-create.spec.ts` — create flow + simplified sections + avatar picker.
- `preferences.spec.ts` — anonymous API gating.
- `visibility.spec.ts` — public/private surfacing in Library + Mine/Team scopes.
- `avatar.spec.ts` — avatar upload persists.
- `projects.spec.ts` — create project, land on chat, task CRUD.

All pass under the `kitchen-sink` fixture. Full suite (~260 tests) is green on branch.

### Manual smoke (`examples/agent`)

1. `pnpm install --ignore-workspace` in `examples/agent`.
2. Create a project, invite two sub-agents, send a message.
3. `@mention` one agent → verify the supervisor calls only that delegate tool.
4. Ask the supervisor to add a task → verify it appears in the right panel without a reload.
5. Ask "find me a good research agent" → accept the `project_propose_agent` card → verify the agent joins the team and gets starred.

---

## 12. Related docs

- `docs/src/content/en/docs/studio/agent-builder.mdx` — product-level overview, configuration reference, permissions matrix, Projects section.
- `LICENSE.md` — enumeration of `ee/` directories.
- `.changeset/studio-agent-builder-ee.md` — release notes.

---

## 13. File map

### Core (`packages/core`)

- `src/agent-builder/ee/types.ts` — config + `IMastraAgentBuilder`.
- `src/agent-builder/ee/tools/{index,shared}.ts` — 5 project tools.
- `src/agent-builder/ee/tools/index.test.ts`
- `src/agent-builder/ee/index.ts` — re-exports.
- `src/auth/ee/license.ts` — `agent-builder` feature flag.
- `src/mastra/index.ts` — `agentBuilder` wiring on the `Mastra` class.
- `src/storage/types.ts` — `StorageAgentRole`, `ProjectMetadata`, `VisibilityValue`, `StorageUserPreferencesType`, thin-record `metadata` on skills.
- `src/storage/domains/agents/{inmemory,filesystem}.ts` — `role` persist + filter.
- `src/storage/domains/skills/{inmemory,filesystem}.ts` — thin-record metadata.
- `src/storage/domains/user-preferences/{base,inmemory,filesystem,index}.ts` — new domain.

### Studio Agent Builder (`packages/studio-agent-builder`)

- `ee/src/{agent-builder,license,index}.ts` — `MastraAgentBuilder` class; license enforcement.
- `ee/src/agent-builder.test.ts`

### Server (`packages/server`)

- `src/server/schemas/{projects,user-preferences,auth,stored-agents}.ts` — schemas added/extended.
- `src/server/handlers/projects.ts` + `.test.ts`.
- `src/server/handlers/user-preferences.ts` + `.test.ts`.
- `src/server/handlers/stored-agents.ts` — avatar upload, ownership guard.
- `src/server/handlers/stored-agents-avatar.test.ts`, `stored-agents-ownership.test.ts`.
- `src/server/handlers/auth.ts` — `POST /auth/users/lookup`.
- `src/server/handlers/tools.ts` — merges `project_*` tools when `agentBuilder` configured.
- `src/server/handlers/system.ts` — `agentBuilderConfig` + `hasDefaultMemoryConfig`.
- `src/server/server-adapter/routes/{projects,user-preferences,index}.ts` — route registration.
- `src/server/server-adapter/index.ts` — EE license gate.

### Client SDK (`client-sdks/client-js`)

- `src/client.ts` — `listProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`, `inviteAgentToProject`, `removeAgentFromProject`, `addProjectTask`, `updateProjectTask`, `deleteProjectTask`, `getUserPreferences`, `updateUserPreferences`, `lookupUsers`.
- `src/resources/stored-agent.ts` — `uploadAvatar`.
- `src/types.ts` — project, preferences, avatar, visibility, user-lookup types.

### Playground (`packages/playground`)

- `src/App.tsx` — `/agent-studio/**` routes + index redirect.
- `src/pages/agent-studio/{agents,projects,library,configure}/**` — 16 pages.
- `src/domains/agent-studio/components/**` — 13 components (sidebar, cards, panels, sharing panels, avatar picker, pending-avatar context, star button, visibility badge, index redirect).
- `src/domains/agent-studio/hooks/**` — 11 hooks (studio config, preview mode, preferences, user lookup, projects, studio agents/skills, recents).
- `src/domains/agents/hooks/use-agent-cms-form.ts` — `authorId`, `autoPublish`, `onAfterCreate`.
- `src/domains/agents/components/agent-cms-form-shell.tsx` + sidebar — `simplifiedSections`, `basePath`, `isStudioMode`.
- `src/pages/cms/agents/edit-layout.tsx` — reusable `EditLayoutWrapper` that both CMS and Studio consume.
- `src/lib/ai-ui/tools/tool-fallback.tsx` — branches for `project_*` tools + query invalidation.
- `e2e/tests/agent-studio/**` — 6 spec files; `kitchen-sink` fixture wires `@mastra/studio-agent-builder`.

### Docs & changeset

- `docs/src/content/en/docs/studio/agent-builder.mdx`
- `.changeset/studio-agent-builder-ee.md`
- `LICENSE.md` — `ee/` directory enumeration.
- `examples/agent` — smoke target with `@mastra/studio-agent-builder` wired via `pnpm.overrides`.
