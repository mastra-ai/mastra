# UI Verification

Browser-based verification of the Agent Builder UI. Use whichever browser tool the harness has wired up (Stagehand, Chrome MCP, etc.). If none is available, skip this section with `--skip-browser` and report ⏭️.

## Tiers

The steps below are split into two tiers. Run **Core** for every UI pass.
Run **Extended** only when the prompt explicitly asks for full UI coverage
or when a code change touches one of those surfaces.

- **Core** (steps 1–8): shell loads, skills list, skills create starter,
  skill edit page, agent list, agent view page, star toggle, role
  impersonation menu (admin/owner only).
- **Extended** (steps 9–14): model dropdown, workspace dropdown, Library
  - Copy flow, registry button gating, origin badges, mobile bottom-bar
    parity, scrollable list layout.

If you skip a step, mark it ⏭️ in the result table with a one-line reason
(e.g. "extended tier not requested").

## Prerequisites

- Browser tool available
- Server running on `localhost:4111`
- Create at least one agent and one skill via API before UI testing (or use existing ones)
- Seeded public skills exist under the scaffolded project's public dir (used by the Library page)

## Steps

### 1. Agent Builder Shell _(Core)_

Navigate to `http://localhost:4111/agent-builder`.

> **Note:** On a totally empty project (no agents and no skills), `/agent-builder` currently redirects to the full-page `/agent-builder/agents/create` starter (no shell, no sidebar). To exercise this step, create at least one agent first (the scaffold's `weather-agent` is registered but stored agents start at zero). Once any stored agent or skill exists, the shell renders.

- [ ] Page loads without error
- [ ] Sidebar visible: `My agents`, `Skills`, `Favorites`, `Library` (main nav)
- [ ] `Infrastructure` is pinned at the bottom of the sidebar, visually separated from the main group
- [ ] No `Workspaces` entry in the sidebar (single-workspace layout)

### 2. Skills List Page _(Core)_

Navigate to `http://localhost:4111/agent-builder/skills`.

- [ ] Header reads `My skills` with subtext `Skills you've created`
- [ ] Filter input present
- [ ] `+ New skill` button top-right
- [ ] Each skill row shows name, description (if set), and a star button
- [ ] Clicking a row navigates to `/agent-builder/skills/<id>/edit` (NOT an inline detail panel)
- [ ] Canonical detail routes are `/agent-builder/skills/<id>/edit` (owner) and `/agent-builder/skills/<id>/view` (non-owner). The bare `/agent-builder/skills/<id>` path is not a registered route — navigate via the list, not by typing the URL.

### 3. Create Skill via UI _(Core)_

Click `+ New skill`. You should land on `/agent-builder/skills/create`.

- [ ] Full-page starter renders with the prompt `What skill do you want to build?`
- [ ] Four example prompt cards are visible (e.g. Code reviewer, Doc summarizer, Onboarding tutor, Research notes — log any drift in labels)
- [ ] Chat input is present at the bottom
- [ ] Submitting a prompt creates a skill via the API and navigates to `/agent-builder/skills/<new-id>/edit` with the prompt forwarded to the chat composer
- [ ] No manual create dialog / no Name+Description form here — the flow is AI-first

### 4. Skill Edit Page _(Core)_

You should be on `/agent-builder/skills/<id>/edit` from step 3 (or by clicking a row on the list).

- [ ] Header: back arrow, skill name. The page is a split workspace.
- [ ] Left panel: chat composer (`Refine your skill` / `Ask the agent to refine...`) with a `Send` button
- [ ] Right panel: skill details form — Name, Description, Instructions
- [ ] No explicit Save button visible — saving is autosaved (look for a saving/saved indicator near the form)
- [ ] `Delete skill` button is reachable somewhere on the page (typically bottom-right of the details panel). If you cannot find it, log that as drift.
- [ ] Visibility selector: not visible under `--auth off` (server forces public). Under `--auth on`, log whether the selector is rendered and where.

### 5. Agent List Page _(Core)_

Navigate to `http://localhost:4111/agent-builder` (or `/agents`).

- [ ] Header reads `My agents` with subtext `Agents you've created`
- [ ] Filter input and `+ New agent` button top-right
- [ ] Each agent row shows name, description (if set), and a star button
- [ ] Clicking a row navigates to `/agent-builder/agents/<id>/view` (NOT `/edit`). Skills list rows go to `/edit`; agents list rows go to `/view`. This asymmetry is intentional — log it if it's reversed.

### 6. Agent View Page _(Core)_

You should be on `/agent-builder/agents/<id>/view`.

- [ ] `View mode` pill badge near the header
- [ ] Header: back arrow, agent name, `View mode` pill (no refresh button)
- [ ] Top-right: `Publish to...` dropdown and avatar
- [ ] Center: agent name + description and a row of starter prompt cards (e.g. What can you do? / Show available tools / Suggest a task / Run a self-check)
- [ ] Bottom: `Message your agent...` chat input — agents are runnable from view

### 7. Star Interaction (UI) _(Core)_

On the skills list page:

- [ ] Click a star icon on a skill
- [ ] Star toggles to filled/active state
- [ ] Click again to unstar; star toggles back to outline/inactive

On the agents list page:

- [ ] Same toggle behavior

### 8. Role impersonation _(Core, admin/owner only)_

UI-only feature wired through `role-impersonation-context.tsx`. Frontend state, no backend role-override header. Only run this subset when the live user is `admin` or `owner` (otherwise the menu is hidden).

Open the user menu → `View as role` (or equivalent picker — confirm exact label in the live UI and log it if it differs):

- [ ] Picker offers `admin`, `member`, `viewer`
- [ ] Selecting `viewer`:
  - [ ] Impersonation banner appears at the top of the page indicating the active role
  - [ ] Sidebar collapses to viewer-allowed entries (no Create/Edit affordances)
  - [ ] Create buttons (e.g. `New skill`, `New agent`) disappear or render disabled
  - [ ] Direct navigation to a write-only route (e.g. `/agent-builder/skills/create`) is blocked at the UI layer
- [ ] Selecting `member`:
  - [ ] Banner updates to show member
  - [ ] Read + execute affordances visible; create/edit hidden
- [ ] `Exit impersonation` (or equivalent) restores the original admin UI

> **Important:** impersonation is UI-only. The API still answers per the _real_ logged-in role. If you `curl` the same endpoint while impersonating viewer, you'll still get the admin's response. That's expected — record it that way in the report, don't file it as a bug.

### 9. Model Dropdown (Agent Create/Edit) _(Extended)_

Navigate to an agent edit page.

- [ ] Model dropdown is visible
- [ ] Shows only allowed providers (from builder model policy)
- [ ] Shows only allowed models per provider
- [ ] Selecting a model updates the agent config

Example verification:

- If builder config allows `{ provider: 'openai' }` (wildcard), all OpenAI models should appear
- If builder config allows `{ provider: 'anthropic', name: 'claude-opus-4-7' }`, only that specific model should appear

### 10. Workspace dropdown (Skill Edit, Advanced mode) _(Extended)_

On the skill edit page, look for an `Advanced mode` toggle. If present:

- [ ] Toggling Advanced mode reveals a Workspace dropdown plus a file tree (SKILL.md, references/, scripts/, assets/)
- [ ] Builder workspace is the auto-selected option

If no Advanced mode toggle exists in the running build, log it as drift and skip.

### 11. Library page (public skills you don't own) _(Extended)_

Navigate to `http://localhost:4111/agent-builder/library`.

- [ ] Header: `Library / Agents shared with the team library`
- [ ] Agents/Skills tab toggle is present
- [ ] On the Skills tab, seeded public skills appear (e.g. `web-design-guidelines`, `api-design-principles`, `vercel-react-best-practices`, `postgres-query-tuning` — log any drift)
- [ ] Under `--auth on`, clicking a row you don't own should navigate to `/agent-builder/skills/<id>/view` (read-only). Under `--auth off` everyone is treated as owner so the navigation lands on `/edit` instead — log which path you observed.
- [ ] Under `--auth on`, a `Copy to my skills` action is available on the view page; submitting it creates a private copy with origin badge `copied`

### 12. Registry Browse button gating _(Extended)_

Still on `/agent-builder/skills`:

- [ ] If `builder.registries.skillsSh.enabled = false`: `Browse registry` button is hidden in both empty-state and top-area
- [ ] If `enabled = true`: button reads `Browse registry` (generic), opens registry dialog

(Full registry flow is covered in `references/registry.md`.)

### 13. Origin badge on skills list _(Extended)_

- [ ] Skills installed from skills.sh show a `skills.sh` badge
- [ ] Skills copied from the library show a `copied` badge with tooltip `Copied from <source>`
- [ ] Skills you authored directly show no origin badge

### 14. Mobile bottom-bar parity _(Extended)_

Resize browser to mobile width (or use the device toggle).

- [ ] Bottom-bar shows the same primary entries as the desktop sidebar (Agents, Skills, Favorites, Library, plus Infrastructure for admins)
- [ ] Tapping each navigates to the matching route and the corresponding tab is active

### 15. Scrollable lists (#16252, #16253) _(Extended)_

On Agents and Skills list pages:

- [ ] Long lists scroll independently of the rest of the layout
- [ ] Column does not collapse when a detail pane (if any) slides in
- [ ] Navigation between list and detail/edit pages animates cleanly (no layout jump)

### Cleanup

If created via UI:

```bash
# Delete the UI-created skill
curl -s $BASE/stored/skills | jq '.skills[] | select(.name == "UI Smoke Skill") | .id'
# Then DELETE with the returned ID
```

## Checklist

- [ ] Agent Builder shell loads with correct sidebar
- [ ] Skills list page renders; rows navigate to `/skills/<id>/edit`
- [ ] Skills create flow is full-page AI-first starter at `/skills/create`
- [ ] Skill edit page is a chat+form split workspace; Delete skill action present
- [ ] Agents list page renders; rows navigate to `/agents/<id>/view`
- [ ] Agent view page renders View mode badge + chat input + starter prompts
- [ ] Star toggle works on skills and agents lists
- [ ] Role impersonation menu works (admin/owner only)
- [ ] Model dropdown respects builder policy
- [ ] Workspace dropdown / Advanced mode behaves per running build
