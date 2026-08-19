# `@mastra/factory`

`@mastra/factory` is the reusable Factory backend. It owns storage, routes, rules, integrations, sandboxes, and Factory-specific agent behavior.

Put React code in [`factory-ui`](../factory-ui/README.md), host wiring in [`web`](../web/README.md), and shared agent-controller behavior in [`sdk`](../sdk/README.md).

## Runtime lifecycle

A host calls `MastraFactory.prepare()`, constructs `new Mastra(...)`, then calls `MastraFactory.finalize()`. The `new Mastra(...)` expression remains in the host entry file so the deployer can detect it.

See `mastracode/web/src/mastra/index.ts` for the host implementation.

## Development

```shell
pnpm --filter ./mastracode/factory test
pnpm --filter ./mastracode/factory check
pnpm --filter ./mastracode/factory lint
pnpm --filter ./mastracode/factory build:lib
pnpm --filter ./mastracode/factory smoke:dist
```

Tests are colocated with source as `*.test.ts`.

## License

Apache-2.0
