# UI Verification

Browser-based verification of the Agent Builder UI. Use whichever browser tool the harness has wired up (Stagehand, Chrome MCP, etc.). If none is available, skip this section with `--skip-browser` and report ⏭️.

## Tiers

The steps below are split into two tiers. Run **Core** for every UI pass.
Run **Extended** only when the prompt explicitly asks for full UI coverage
or when a code change touches one of those surfaces.

- **Core** (steps 1–8): shell loads, skills list, skills create starter,
  skill edit page, agent list, agent view page, star toggle, role
  impersonation menu (admin/owner only).
- **Extended** (steps 9–15): model dropdown, workspace dropdown, Library
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

> **Route naming.** The `Favorites` sidebar item navigates to `/agent-builder/favorite` (**singular**), not `/favorites`. The plural URL is not registered and returns a React Router 404. Use the sidebar link or the singular path when scripting navigation; don't autocomplete to the plural form.

### 2. Skills List Page _(Core)_

Navigate to `http://localhost:4111/agent-builder/skills`.

- [ ] Header reads `My skills` with subtext `Skills you've created`
- [ ] Filter input present
- [ ] `+ New skill` button top-right
- [ ] Each skill row shows name, description (if set), and a star button
- [ ] Clicking a row navigates to `/agent-builder/skills/<id>/edit` (NOT an inline detail panel)
- [ ] Canonical detail routes are `/agent-builder/skills/<id>/edit` (owner) and `/agent-builder/skills/<id>/view` (non-owner). The bare `/agent-builder/skills/<id>` path redirects to `/edit` — prefer navigating via the list, since the redirect target doesn't depend on ownership.

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
- [ ] Visibility selector: not visible under `--auth off` (server forces public). Under `--auth on`, the selector renders in the page-header action group on `lg` viewports and above (≥1024px) via `VisibilitySelectConnected`. Below `lg` it moves into the mobile menu (`SkillBuilderMobileMenu` with `showSetVisibility`). Resize the viewport or open the mobile menu to confirm if the desktop slot looks empty.

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
- [ ] Top-right action group contains exactly `Switch to Edit mode`. There is no `Add to library`, `Show configuration`, `Make public`, or `Share` button in the view-page header under either `--auth off` or `--auth on`. The library/visibility toggle for an agent (auth-on, owner) is exposed on the **edit page** right panel as `Add to library` (when private) ↔ `Remove from library` (when public) — clicking it flips `visibility` between `private` and `public`. There is no separate `Show configuration` button anywhere in the live build (May 28, 2026). The avatar lives in the sidebar user menu, not in this header.
- [ ] Center: agent name + description and a row of starter prompt cards (e.g. What can you do? / Show available tools / Suggest a task / Run a self-check)
- [ ] Bottom: `Message your agent...` chat input — agents are runnable from view

### 7. Favorite Interaction (UI) _(Core)_

> Renamed from "Star" after the `stars → favorites` rename. The icon is still a star glyph, but the underlying state is the `favorited`/`favoriteCount` pair on the row.

On the skills list page (under `--auth on`):

- [ ] Click the star icon on a skill row
- [ ] Star toggles to filled/active state; `favoriteCount` increments by 1
- [ ] Click again to unfavorite; star toggles back to outline/inactive and `favoriteCount` decrements

On the agents list page (under `--auth on`):

- [ ] Same toggle behavior

Under `--auth off` the rows render the star button but it is a **deliberate no-op**: the aria-label is `Sign in to star this {agent|skill}`, clicking does nothing, and `favoriteCount` stays at `0`. Record this as expected — don't file it as a bug. The misleading "sign in" label exists because there is no sign-in flow when auth is off; if you see anything else (toast, state change, count change) log it as drift.

### 8. Role impersonation _(Core, admin/owner only)_

UI-only feature wired through `role-impersonation-context.tsx`. Frontend state, no backend role-override header. Only run this subset when the live user is `admin` or `owner` (otherwise the menu is hidden).

Open the user menu → the picker label is `PREVIEW AS ROLE` (a section header in the user menu). Each role is its own menu item directly under that header.

- [ ] Picker offers only roles **different from the current role**. Logged in as admin, you'll see `Member` and `Viewer` (no `Admin` item — admin is the implicit baseline). This is intentional.
- [ ] Selecting `Viewer`:
  - [ ] Impersonation banner appears at the top of the page indicating the active role
  - [ ] Sidebar collapses to viewer-allowed entries (no Create/Edit affordances)
  - [ ] `Infrastructure` sidebar entry remains visible — viewer permissions include `*:read`, which matches `infrastructure:read`. The infra page itself is read-only for viewers. Not a regression.
  - [ ] Create buttons (e.g. `New skill`, `New agent`) disappear or render disabled
  - [ ] Direct navigation to a write-only route (e.g. `/agent-builder/skills/create`) is blocked at the UI layer
- [ ] Selecting `Member`:
  - [ ] Banner updates to show member
  - [ ] Read + execute affordances visible; create/edit hidden
- [ ] The exit affordance is labeled `Exit role preview` (in the impersonation banner and as a user-menu item under the role list). Clicking it restores the original admin UI.

> **Important:** impersonation is UI-only. The API still answers per the _real_ logged-in role. If you `curl` the same endpoint while impersonating viewer, you'll still get the admin's response. That's expected — record it that way in the report, don't file it as a bug.

### 8b. Run 3 / non-admin UI parity _(Core, non-admin runs only)_

Run this **instead of** step 8 under `--auth on --role member` or `--role viewer`. Step 8 (role impersonation) is admin-only — when the live user is a non-admin, the picker is hidden and there's nothing to impersonate.

The goal here is to record the live UI surface for a non-admin and confirm it matches the permission matrix in `references/permissions.md`. Anything that contradicts the matrix is a real bug; anything that matches is expected.

- [ ] Sidebar entries visible match the user's actual permissions (see matrix). All of `My agents`, `Skills`, `Favorites`, `Library`, `Infrastructure` are visible to every default role under `--auth on` because each has `*:read`.
- [ ] User-menu **does not** contain a `PREVIEW AS ROLE` section (admin/owner only).
- [ ] Create buttons (`New skill`, `New agent`) visible to **member** (member has `stored-{skills,agents}:write`); hidden or disabled for **viewer**.
- [ ] Direct navigation to `/agent-builder/skills/create` and `/agent-builder/agents/create`:
  - **member:** page loads (write perm present)
  - **viewer:** redirected to the list page (Navigate via `canWrite` guard)
- [ ] On a public skill the current user does **not** own:
  - `Copy` button visible to **member** (has `stored-skills:write`); hidden for **viewer**
  - `Delete` and `Publish` affordances hidden for both (admin-only verbs)
- [ ] `Infrastructure` page renders for both member and viewer (read-only surface — deployment-shape data, no secrets).

> If you observe a write-only UI affordance rendering for **viewer**, log it as a real product issue. If you observe a read-only UI affordance failing to render for **member**, same.

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

- [ ] Header: `Library` with subtext `Agents shared with the team library`
- [ ] Agents/Skills tab toggle is present
- [ ] On the Skills tab, the seeded public skill appears: `Seeded public skill` (id `smoke-seed-public-skill`, owner `user_seed_other`). The private companion (`smoke-seed-private-skill`) must **not** appear here for non-owners. See `scripts/seed-multi-user.sh` for the canonical fixtures.
- [ ] Under `--auth on`, clicking a row you don't own should navigate to `/agent-builder/skills/<id>/view` (read-only). Under `--auth off` everyone is treated as owner so the navigation lands on `/edit` instead — log which path you observed.
- [ ] Under `--auth on`, a `Copy to my skills` action is available on the view page for any public skill owned by another user; submitting it creates a private copy with origin badge `copied`. As of May 28, 2026 this affordance is not yet wired into the Agents tab (private agents show `Mark an agent as Public to share it with the team library` instead of a Copy CTA, even when viewing somebody else's public agent) — log absence as known drift.
- [ ] Under `--auth off`, the Library page lists every stored entity because visibility is coerced to public, but the `Copy to my skills` / `Copy to my agents` action is hidden (no caller to attribute the copy to). Don't assert on Copy behavior under auth off.

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

- [ ] Bottom-bar shows the same primary entries as the desktop sidebar (Agents, Skills, Favorites, Library, Infrastructure — Infrastructure is read-only for all default roles since the payload is deployment-shape with no secrets)
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
