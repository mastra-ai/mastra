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

The first-Factory wizard keeps repository and model selections in a session-scoped draft. Users can edit them before the final review, including switching between GitHub and GitLab. Confirmation creates the Factory, links the selected repository, and saves its default model. If a save fails, retry resumes the pending Factory. Credentials are never included in the draft.

Connecting an integration or model account authorizes that reusable connection immediately. Provider sign-in and API-key entry use the existing backend endpoints and capability metadata; organization and personal access remain separate. Members without shared credentials must choose a personal model, which becomes both the Factory default and their own default. Otherwise, personal connection setup is optional. These choices do not add spending policies or change teammates’ defaults.

Linear, Jira, and incident.io appear when their backend integrations are available. The animated illustrations show example work; importing issues happens after setup. Illustrations respect reduced motion, and compact layouts keep the controls full width above the visual.

## Board activity

Cards on the **Work** and **Review** boards show the last person recorded in the work item's audit history. Hover over the person's name or profile image to open the recent event timeline for that card.

Factory stores actor names and profile images in audit event metadata when events are written. For older events without that metadata, Factory resolves actor profiles through the configured authentication provider and falls back to the stored actor ID and an initial.

## Needs attention

**Needs attention** is a project-member action center. The footer previews unresolved terminal automation failures and shows proposed runs as one approval-queue total rather than one notification per proposal. Failures are reconciled against canonical Factory state before they become queryable: an accepted transition is `succeeded`, obsolete work is `superseded`, and only unresolved `failed` decisions remain.

`/factories/:factoryId/attention` provides Open, Unread, and Archived failure views plus a link to the existing approval queue. **Go to** opens the failed decision's matching role session; if that role has no session, it opens the correct Work or Review board and highlights the linked card. Retry appears only for typed failures whose policy allows it.

Read and archive are per-user. Retry, reconciliation, approval, and dismissal update canonical decision state for every member. A later terminal failure increments the decision's occurrence and reappears unread without allowing a delayed receipt from the previous occurrence to hide it.

Successful run completions continue to use the live Ready indicator and completion sound on sidebar session rows. Failure sounds establish a silent initial baseline and use a cross-tab lock so one occurrence plays once.

## Tests

Use unit tests for isolated code and MSW tests for pages, routes, hooks, mutations, and React Query behavior.

```shell
pnpm --filter ./mastracode/factory-ui test:unit
pnpm --filter ./mastracode/factory-ui test:msw
pnpm --filter ./mastracode/factory-ui typecheck
pnpm --filter ./mastracode/factory-ui build
```

See [`AGENTS.md`](./AGENTS.md) for testing conventions.
