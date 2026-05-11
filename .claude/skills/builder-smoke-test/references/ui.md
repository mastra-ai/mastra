# UI Verification

Browser-based verification of the Agent Builder UI. Use whichever browser tool the harness has wired up (Stagehand, Chrome MCP, etc.). If none is available, skip this section with `--skip-browser` and report ⏭️.

## Tiers

The steps below are split into two tiers. Run **Core** for every UI pass.
Run **Extended** only when the prompt explicitly asks for full UI coverage
or when a code change touches one of those surfaces.

- **Core** (steps 1–7): shell loads, skills list, create-skill dialog,
  agent detail page, skills section, star toggle, visibility badges.
- **Extended** (steps 8–14): model dropdown, workspace dropdown, Library
  + Copy flow, registry button gating, origin badges, mobile bottom-bar
  parity, scrollable list layout.

If you skip a step, mark it ⏭️ in the result table with a one-line reason
(e.g. "extended tier not requested").

## Prerequisites

- Browser tool available
- Server running on `localhost:4111`
- Create at least one agent and one skill via API before UI testing (or use existing ones)
- Seeded public skills exist in `examples/agent/src/mastra/public/mastra.db` (used by the Library page)

## Steps

### 1. Agent Builder Shell *(Core)*

Navigate to `http://localhost:4111/agent-builder`.

- [ ] Page loads without error
- [ ] Sidebar visible with navigation links
- [ ] "Skills" link visible in sidebar (features.skills = true)
- [ ] Agent list or default view renders

### 2. Skills List Page *(Core)*

Navigate to `http://localhost:4111/agent-builder/skills`.

- [ ] Page loads
- [ ] Skills list renders (or empty state if no skills exist)
- [ ] Each skill shows:
  - [ ] Name
  - [ ] Description (if set)
  - [ ] Visibility badge ("Public" or "Private")
  - [ ] Star icon/button
- [ ] Skills are NOT clickable (no detail page exists yet)

### 3. Create Skill via UI *(Core)*

Click the "New Skill" or "Create" button on the skills page.

- [ ] Dialog/form opens
- [ ] Name field present and editable
- [ ] Description field present
- [ ] Workspace dropdown shows builder workspace (auto-selected)
- [ ] Visibility selector present (defaults to Private)
- [ ] Save/Create button present
- [ ] Fill in name: "UI Smoke Skill", description: "Created via UI smoke test"
- [ ] Change visibility to Public
- [ ] Click Create/Save
- [ ] Skill appears in the list with "Public" badge

**Known issue**: The Create button's `disabled` state may not update properly when typing via browser automation. If the button stays disabled, try clicking into the name field, clearing it, and retyping.

### 4. Agent Detail Page *(Core)*

Navigate to an existing stored agent's detail page: `http://localhost:4111/agent-builder/agents/<agentId>`.

If no stored agent exists, create one via API first.

- [ ] Agent detail page loads
- [ ] Agent name displayed
- [ ] Model displayed (provider and model ID)
- [ ] Instructions displayed
- [ ] Visibility shown
- [ ] Skills section visible (shows attached skills or empty state)
- [ ] Chat panel visible on the right

### 5. Agent Skills Section *(Core)*

On the agent detail page:

- [ ] Skills section shows count (e.g., "Skills 0/1" or "Skills 1/2")
- [ ] Toggle/expand panel shows attached skills
- [ ] Skills can be toggled on/off (if skill management UI exists)

### 6. Star Interaction (UI) *(Core)*

On the skills list page:

- [ ] Click a star icon on a skill
- [ ] Star toggles to filled/active state
- [ ] Click again to unstar
- [ ] Star toggles back to outline/inactive

On the agent list (if star icons exist there):

- [ ] Same toggle behavior

### 7. Visibility Badge Correctness *(Core)*

- [ ] Private entities show "Private" badge
- [ ] Public entities show "Public" badge
- [ ] Runtime agents (if any) show "Runtime" badge
- [ ] Badges are visually distinct (different colors/styles)

### 8. Model Dropdown (Agent Create/Edit) *(Extended)*

Navigate to the agent create or edit page.

- [ ] Model dropdown is visible
- [ ] Shows only allowed providers (from builder model policy)
- [ ] Shows only allowed models per provider
- [ ] Selecting a model updates the agent config

Example verification:

- If builder config allows `{ provider: 'openai' }` (wildcard), all OpenAI models should appear
- If builder config allows `{ provider: 'anthropic', modelId: 'claude-opus-4-7' }`, only that specific model should appear

### 9. Workspace Dropdown (Skill Create) *(Extended)*

In the skill creation dialog:

- [ ] Workspace dropdown shows available workspaces
- [ ] Builder workspace is auto-selected
- [ ] Archived workspaces do NOT appear in dropdown
- [ ] User-created workspaces (if any) also appear

### 10. Library page (public skills you don't own) *(Extended)*

Navigate to `http://localhost:4111/agent-builder/library`.

- [ ] Page loads; shows public stored skills authored by other users
- [ ] Seeded public skills appear: `web-design-guidelines`, `api-design-principles`, `vercel-react-best-practices`, `postgres-query-tuning`
- [ ] Click a skill → read-only detail dialog opens
- [ ] "Copy" button visible (replaces Edit for non-owners on public skills)
- [ ] Click "Copy" → name prompt dialog appears with default `<name>-copy`
- [ ] Submit → toast confirms; new private skill appears in your skills list
- [ ] Copied skill shows "copied" origin badge in the list

### 11. Registry Browse button gating *(Extended)*

Still on `/agent-builder/skills`:

- [ ] If `builder.registries.skillsSh.enabled = false`: "Browse registry" button is hidden in both empty-state and top-area
- [ ] If `enabled = true`: button reads "Browse registry" (generic), opens registry dialog

(Full registry flow is covered in `references/registry.md`.)

### 12. Origin badge on skills list *(Extended)*

- [ ] Skills installed from skills.sh show a skills.sh badge
- [ ] Skills copied from the library show a "copied" badge with tooltip "Copied from <source>"
- [ ] Skills you authored directly show no origin badge

### 13. Mobile bottom-bar parity *(Extended)*

Resize browser to mobile width (or use the device toggle).

- [ ] Bottom-bar shows the same primary entries as the desktop sidebar (Agents, Skills, Library, Workspaces, Infra for admin)
- [ ] Tapping each navigates to the matching route (`/agent-builder`, `/agent-builder/skills`, `/agent-builder/library`, `/agent-builder/workspaces`, `/agent-builder/infrastructure`) and the corresponding tab is active

### 14. Scrollable lists (#16252, #16253) *(Extended)*

On Agents and Skills list pages:

- [ ] Long lists scroll independently of the rest of the layout
- [ ] Column does not collapse when the detail pane slides in
- [ ] Detail pane animates in cleanly (no layout jump)

### Cleanup

If created via UI:

```bash
# Delete the UI-created skill
curl -s $BASE/stored/skills | jq '.skills[] | select(.name == "UI Smoke Skill") | .id'
# Then DELETE with the returned ID
```

## Checklist

- [ ] Agent Builder shell loads
- [ ] Skills list page renders with correct data
- [ ] Create skill via UI dialog
- [ ] Agent detail page shows all fields
- [ ] Skills section on agent page
- [ ] Star toggle works in UI
- [ ] Visibility badges render: `Private` (lock icon) for private records, `Public` for public records, `Runtime` for code-defined agents/skills
- [ ] Model dropdown respects builder policy
- [ ] Workspace dropdown shows correct options
