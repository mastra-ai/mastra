# Factory UI

`@internal/factory-ui` is the Factory React application. It owns pages, client state, API access, and browser tests.

## Development

Complete the [repository setup](../README.md#setup) and [GitHub App setup](../web/README.md#configure-local-onboarding). Then start the Docker services, the API, and the Vite dev server:

```shell
pnpm --dir mastracode/web dev:ui
```

Open `http://localhost:5173`. To restart one side without losing the other, start the Docker services with `pnpm --dir mastracode/web db:up`, then run `pnpm --dir mastracode/web api` and `pnpm --filter ./mastracode/factory-ui dev` in separate terminals.

Keep policy, validation, and persistence in [`@mastra/factory`](../factory/README.md), not in React.

## Review stacks

The Review board groups dependent pull requests inside each stage column, with base pull requests first. A dashed container surrounds each stack, with a header identifying its root pull request, including when other members are in another stage or hidden by a filter. Cards are dragged individually; the container does not move the whole stack. Standalone pull requests keep their usual card layout.

Stacks are derived from matching base and head branches in the same repository, using saved cards and currently loaded Intake candidates. Additional candidate pages can reveal more of a stack. Closed or merged pull requests and cards with missing or ambiguous branch information remain ungrouped. Grouping does not change card actions or stage transitions.

Work boards remain scoped to one Factory project.

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
