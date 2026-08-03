# `@mastra/factory`

`@mastra/factory` is the reusable Factory backend. It owns storage, routes, rules, integrations, sandboxes, and Factory-specific agent behavior.

Put React code in [`factory-ui`](../factory-ui/README.md), host wiring in [`web`](../web/README.md), and shared agent-controller behavior in [`sdk`](../sdk/README.md).

## Runtime lifecycle

A host calls `MastraFactory.prepare()`, constructs `new Mastra(...)`, then calls `MastraFactory.finalize()`. The `new Mastra(...)` expression remains in the host entry file so the deployer can detect it.

See `mastracode/web/src/mastra/index.ts` for the host implementation.

## GitHub installation health

Factory reports removed or suspended GitHub App installations through its existing web routes:

- `POST /web/github/projects/:id/ensure` and `GET /web/github/projects/:id/issues` return HTTP `424` with `error: "github_installation_broken"`. The response also includes `message`, `installationId`, and `accountLogin`. The server-sent events form of `/ensure` emits the same error code and context in its `error` event.
- `GET /web/github/status` returns healthy installations in `installations` and removed or suspended installations in `brokenInstallations`. Each broken entry includes `installationId`, `accountLogin`, `accountType`, and `brokenAt`, where `brokenAt` is a Unix timestamp in milliseconds.
- After a completed GitHub reconnect callback, clients call `POST /web/github/installations/:id/confirm-reconnect`. Factory verifies access to repositories already linked to that installation before clearing its durable broken state. Missing repository access returns HTTP `424` with `error: "github_installation_broken"`; other upstream failures return HTTP `502` with `error: "github_fetch_failed"`. Either failure leaves the installation broken.

Clients should direct users to the existing GitHub connection-management flow when either contract reports a broken installation.

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
