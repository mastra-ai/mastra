# Factory UI

`@internal/factory-ui` is the Factory React application. It owns pages, client state, API access, and browser tests.

## Development

Complete the [repository setup](../README.md#setup) and [GitHub App setup](../web/README.md#configure-local-onboarding). Then run these in separate terminals:

```shell
pnpm --dir mastracode/web api
```

```shell
pnpm --filter ./mastracode/factory-ui web
```

Open `http://localhost:5173`.

Keep policy, validation, and persistence in [`@mastra/factory`](../factory/README.md), not in React.

## Board activity

Cards on the **Work** and **Review** boards show the last person recorded in the work item's audit history. Hover over the person's name or profile image to open the recent event timeline for that card.

Factory resolves names and profile images through the configured authentication provider. When a provider can't resolve an older actor, the card falls back to the stored actor ID and an initial.

## Tests

Use unit tests for isolated code and MSW tests for pages, routes, hooks, mutations, and React Query behavior.

```shell
pnpm --filter ./mastracode/factory-ui test:unit
pnpm --filter ./mastracode/factory-ui test:msw
pnpm --filter ./mastracode/factory-ui typecheck
pnpm --filter ./mastracode/factory-ui build
```

See [`AGENTS.md`](./AGENTS.md) for testing conventions.
