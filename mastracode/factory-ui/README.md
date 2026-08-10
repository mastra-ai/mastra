# Factory UI

`@internal/factory-ui` is the Factory React application. It owns pages, client state, API access, and browser tests.

## Development

Complete the [repository setup](../README.md#setup) and [GitHub App setup](../web/README.md#configure-local-onboarding). Then start the Docker services, the API, and the Vite dev server:

```shell
pnpm --dir mastracode/web dev:ui
```

Open `http://localhost:5173`. To restart one side without losing the other, run `pnpm --dir mastracode/web api` and `pnpm --dir mastracode/web ui` in separate terminals.

Keep policy, validation, and persistence in [`@mastra/factory`](../factory/README.md), not in React.

## Board activity

Cards on the **Work** and **Review** boards show the last person recorded in the work item's audit history. Hover over the person's name or profile image to open the recent event timeline for that card.

Factory stores actor names and profile images in audit event metadata when events are written. For older events without that metadata, Factory resolves actor profiles through the configured authentication provider and falls back to the stored actor ID and an initial.

## Tests

Use unit tests for isolated code and MSW tests for pages, routes, hooks, mutations, and React Query behavior.

```shell
pnpm --filter ./mastracode/factory-ui test:unit
pnpm --filter ./mastracode/factory-ui test:msw
pnpm --filter ./mastracode/factory-ui typecheck
pnpm --filter ./mastracode/factory-ui build
```

See [`AGENTS.md`](./AGENTS.md) for testing conventions.
