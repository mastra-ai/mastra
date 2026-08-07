# `@mastra/factory`

`@mastra/factory` is the reusable Factory backend. It owns storage, routes, rules, integrations, sandboxes, and Factory-specific agent behavior.

Put React code in [`factory-ui`](../factory-ui/README.md), host wiring in [`web`](../web/README.md), and shared agent-controller behavior in [`sdk`](../sdk/README.md).

## Runtime lifecycle

A host calls `MastraFactory.prepare()`, constructs `new Mastra(...)`, then calls `MastraFactory.finalize()`. The `new Mastra(...)` expression remains in the host entry file so the deployer can detect it.

See `mastracode/web/src/mastra/index.ts` for the host implementation.

## Durable factory filesystem (`filesystem`)

Passing a `WorkspaceFilesystem` as `MastraFactoryConfig.filesystem` (`PlatformFilesystem` on deployments, `LocalFilesystem` in dev) mounts a durable filesystem at `/factory` in every Factory session workspace. Files written there survive sandbox teardown and are shared across sessions — a good home for anything that doesn't belong in version control (plans, notes, handoffs, scratch data); how it's organized is up to agents and users. The layout is `/factory/shared` (org-wide), `/factory/projects/<project>/shared`, and `/factory/projects/<project>/repos/<repo>`; a session only sees `/shared` and its own project's directory, and the backing store is namespaced per org. See `src/filesystem.ts`.

The web UI exposes a read-only browser for this filesystem (the "Files" page, `/web/factory/fs/*` routes in `src/routes/factory-fs.ts`): signed-in org members can browse the whole org tree — the current project's directory opens by default.

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
