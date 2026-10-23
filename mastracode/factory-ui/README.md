# Factory UI

`@internal/factory-ui` is the Factory React application. It owns pages, client state, API access, and browser tests.

## Development

Complete the [repository setup](../README.md#setup) and [GitHub App setup](../web/README.md#configure-local-onboarding). Then start the Docker services, the API, and the Vite dev server:

```shell
pnpm --dir mastracode/web dev:ui
```

Open `http://localhost:5173`. To restart one side without losing the other, start the Docker services with `pnpm --dir mastracode/web db:up`, then run `pnpm --dir mastracode/web api` and `pnpm --filter ./mastracode/factory-ui dev` in separate terminals.

Keep policy, validation, and persistence in [`@mastra/factory`](../factory/README.md), not in React.

## Onboarding

The onboarding Setup step offers three equal choices, one per existing `modelScope` creation value:

| Choice                           | Scope     | Factory work                                  | Interactive sessions                             |
| -------------------------------- | --------- | --------------------------------------------- | ------------------------------------------------ |
| Company account                  | `factory` | Organization credentials and Factory default  | Organization credentials and Factory default     |
| Company work · personal sessions | `hybrid`  | Organization credentials and Factory default  | Session owner's personal credentials and default |
| Personal accounts                | `user`    | Work owner's personal credentials and default | Session owner's personal credentials and default |

There is no fallback between account scopes. Each teammate configures their own personal account. Onboarding asks for one connection in `factory` or `user`, and a separate connection for each scope in `hybrid`. Existing scoped connections can be reused. Only organization key admins can add shared credentials; members can use connections already configured by an admin. When no company connection exists and the member cannot add one, Setup only offers personal accounts. Scope changes happen only in Setup, never as a side effect of a later step. Local servers without web authentication skip Setup and create a `factory` Factory, so sessions and Factory work share the model chosen in their single connection step.

Model pickers and final confirmation use `/web/config/models?scope=org` or `?scope=user`; live session catalogs still resolve the session owner and policy before considering settings filters. Credentials are saved when connected. Factory creation and the applicable default-model writes happen on final confirmation; setting a personal default also affects other work using that person's default.

The session-storage draft contains choices, never credentials. Legacy drafts without `modelScope` return to Setup with their repository and model preserved. Failed creation resumes the pending Factory; changing its scope recreates that unfinished Factory rather than bypassing the admin-only scope update. Preview fixtures and screenshot tooling stay outside this package.

## Board views

Boards open as a list grouped by workflow status. Click a status heading, or focus it and press Enter or Space, to collapse or expand its issues. Counts and create actions remain available when a group is collapsed; creating an issue or following an issue link reveals its group.

Saved views can use either the list or Kanban layout. Existing saved views keep their selected layout.

## Board activity

Cards on the **Work** and **Review** boards show the last person recorded in the work item's audit history. Hover over the person's name or profile image to open the recent event timeline for that card.

Factory stores actor names and profile images in audit event metadata when events are written. For older events without that metadata, Factory resolves actor profiles through the configured authentication provider and falls back to the stored actor ID and an initial.

## Activity

**Activity** sits at the bottom of the sidebar, just above your account menu. Its badge counts unread failures, supervisor findings, waiting agents, and mentions; a dot marks anything still open, proposed runs included. Failures are reconciled against canonical Factory state before they become queryable: an accepted transition is `succeeded`, obsolete work is `superseded`, and only unresolved `failed` decisions remain.

The **Activity** page (`/factories/:factoryId/activity`) opens with **Needs you**: open failures, supervisor findings, waiting agents, mentions, and proposed runs. Discussions you follow that moved on get their own list underneath, so older failures never sort in among them. Hovering a row swaps its kind and age for its actions (ask supervisor, retry, run, dismiss, mark read, archive); on touch screens they share a line under the title. **Mark all read** clears the unread count, and the properties menu switches between open and archived items. Opening a row goes to the failed decision's matching role session; if that role has no session, it opens the correct Work or Review board and highlights the linked card. Retry appears only for typed failures whose policy allows it.

Below it, the **Timeline** tells what moved, who moved it, and flags cards that need you. Its properties menu shapes the stream:

- **Group**: **Similar** folds one hand's run of the same deed into one sentence; **None** lists every audit event on its own line, with a details toggle for its recorded metadata.
- **Filter**: limits the stream to work items, runs, git, agent, or intake events.
- **Compact view**: tighter rows without avatars; grouped cards fold behind their count.
- **Open audit log in WorkOS**, when the deployment has an audit portal.

The **Codebase** view lists the linked repository's recent commits by day. The old Overview, Attention, and Metrics URLs redirect to Activity; the old Audit URL opens it ungrouped (`?events=all`).

Read and archive are per-user. Retry, reconciliation, approval, and dismissal update canonical decision state for every member. A later terminal failure increments the decision's occurrence and reappears unread without allowing a delayed receipt from the previous occurrence to hide it.

Successful run completions continue to use the live Ready indicator and completion sound on sidebar session rows. Failure sounds establish a silent initial baseline and use a cross-tab lock so one occurrence plays once.

Opening a Factory lands on its first board; **Boards** lead the sidebar, followed by Supervisor and Knowledge.

## Session titles

Slack sessions use the same automatic title generation as web sessions, including the preceding Slack thread context available to the agent. Until naming succeeds, the sidebar shows the session's work item title, or its branch when it has none. Older sessions that still show the generic `slack conversation` label keep it until observational memory retitles the conversation or the owner regenerates the title.

Owners can choose **Regenerate title** from a web or Slack session's sidebar menu to name it from its stored conversation. Regeneration uses the existing title model and does not start a workspace. Automatic naming failures leave the conversation usable; an explicit regeneration reports its error.

## User menu and settings

The sidebar footer shows your profile picture (or an initial), name, and email. It opens a user menu with shortcuts to **My account**, **Preferences**, and **Connections**. **Settings** opens **Models**, the theme control switches between system, light, and dark appearance, and **Log out** ends the current session. Deployments without authentication show a **Settings** menu without account or logout actions.

Settings navigation groups pages by topic: **Account**, **Agent** (Models, Memory, Skills, Behavior), and **Factory**. **Models** picks the Factory's routing (`user`, `hybrid`, or `factory`) and shows the personal and Factory defaults side by side; the defaults the routing leaves unused fold behind a **Settings** toggle, which `#personal-defaults` / `#factory-defaults` links open, because chats with no personal default still fall back to the Factory default. **Memory** holds personal and Factory observational memory. Retired `personal-models` and `factory-memory` URLs redirect to Models and Memory, and navigation stays searchable. **Back to app** returns to the page where settings was opened, including its filters, even after switching sections through the user menu.

## Tests

Use unit tests for isolated code and MSW tests for pages, routes, hooks, mutations, and React Query behavior.

```shell
pnpm --filter ./mastracode/factory-ui test:unit
pnpm --filter ./mastracode/factory-ui test:msw
pnpm --filter ./mastracode/factory-ui typecheck
pnpm --filter ./mastracode/factory-ui build
```

See [`AGENTS.md`](./AGENTS.md) for testing conventions.
