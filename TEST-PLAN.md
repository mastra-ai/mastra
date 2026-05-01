# Test Plan: Workspace Skills Integration

## Prerequisites

- `examples/agent` running on `localhost:4111`
- Signed in as admin (WorkOS)
- Fresh DB (or known state)

---

## 1. Workspace Persistence on Startup

**Goal**: Verify `builder-workspace` is auto-persisted to DB when server starts.

- [x] Start server → `builder-workspace` exists in `mastra_workspaces` table
- [x] Stored workspace has correct `name`, `filesystem` (local, basePath), and `sandbox` (daytona)
- [ ] Restart server → verify no duplicate/error (idempotent)

## 2. Workspace Persistence on Agent Creation

**Goal**: Verify `ensureStoredWorkspace` persists workspace when creating an agent.

- [x] Create a new agent ("Research Assistant") via Agent Builder
- [x] Agent `C563W_H0zHfFiQLbWM0sb` in DB with `workspace: { type: 'id', workspaceId: 'builder-workspace' }`
- [x] `builder-workspace` still exists in stored workspaces (not duplicated)

## 3. Stored Workspaces in UI

**Goal**: Verify stored workspaces appear in the correct dropdowns.

- [x] Skill Edit Dialog → workspace dropdown shows `builder-workspace`
- [x] Dropdown does NOT show agent-specific runtime workspaces
- [x] Builder default workspace is auto-selected

## 4. Skill Creation via UI

**Goal**: Verify creating a skill through the dialog works end-to-end.

- [x] Created skill via Agent Builder skills page (New skill button)
- [x] Created `research-skill` (public) and `greeting-skill` (private)
- [x] `builder-workspace` auto-selected as workspace
- [x] Visibility defaulted to Private, changed to Public for research-skill
- [x] Save → skills appear in stored skills list with correct visibility badges and star buttons
- [x] Skill files written to `.mastra/workspace/skills/<name>/` (SKILL.md, LICENSE.md)
- [x] Stored skills in DB have correct `authorId`, `visibility`

## 5. Skill Creation via Agent Builder AI Tool

**Goal**: Verify the AI create-skill tool works with the builder workspace.

- [ ] In Agent Builder edit page, ask the AI to create a skill
- [ ] Verify it uses the builder default workspace
- [ ] Verify skill created in both filesystem and DB

## 6. Skills Feature Gating

**Goal**: Verify skills UI is properly gated by feature flag.

- [x] With `skills: true` in builder features → CMS sidebar shows "Skills" link
- [x] Agent Builder sidebar shows "Skills" link
- [ ] (If possible) Disable `skills` feature → verify links hidden

## 7. Agent Builder Skills List Page

**Goal**: Verify the new `/agent-builder/skills` page works.

- [x] Navigate to `/agent-builder/skills`
- [x] Skills display name, description, visibility badge
- [x] Star button renders
- [x] Skills are NOT clickable (link removed — no stored-skill detail page yet)
- **Known issue**: No stored-skill detail page exists. Workspace skill detail page (`/workspaces/:id/skills/:name`) uses filesystem-based discovery, which won't work for stored skills.

## 8. Skill Visibility & Ownership

**Goal**: Verify visibility and ownership behave correctly for skills.

- [x] Created public skill (`research-skill`) → shows "Public" badge
- [x] Created private skill (`greeting-skill`) → shows "Private" badge
- [x] `authorId` is set on created skills
- [ ] (If possible) Switch users → verify private skills not visible to other users

## 9. Filesystem Capability Check

**Goal**: Verify the dialog warns when workspace lacks filesystem.

- [ ] If a workspace without filesystem exists in the dropdown, select it
- [ ] Verify warning banner appears: "No filesystem configured"
- [ ] Verify Save button is disabled

## 10. Edge Cases

- [ ] Create skill with same name as existing → verify behavior (error or slug dedup)
- [ ] Create skill without selecting workspace → verify behavior

---

## 11. Adding Skills to an Agent

**Goal**: Verify a created skill can be attached to an agent.

- [x] Agent "Friendly Greeter" has skills attached from creation (AI-generated)
- [x] Agent view page shows "Skills 1/1" section with toggle panel
- [ ] Verify adding/removing skills via CMS skills page

## 12. Using Skills in Agent Conversation

**Goal**: Verify an agent with an attached skill can actually use it.

- [ ] Chat with the agent that has a skill attached
- [ ] Agent responded with "Thinking…" — may be LLM API latency or error
- [ ] Needs manual verification

---

## Not in Scope (for later PRs)

- Stored skill detail page (`/agent-builder/skills/:skillId`)
- Scope tabs ("My skills" / "All skills") on skills list
- Skill publishing flow (draft → published)
- Sandbox scoping per agent/thread (Caleb's suggestion)
- Workspace caching / instance sharing across agents
- Third-party filesystem providers (S3, GCS)
- Skills for non-admin (member) users
