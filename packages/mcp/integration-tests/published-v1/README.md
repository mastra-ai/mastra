# Published MCP 1.x compatibility

This consumer installs published `@mastra/mcp@1.17.3` with this checkout's `@mastra/core`. It does not import workspace source or the workspace MCP package.

`@mastra/core` and its workspace dependencies come from the E2E registry snapshot: a Verdaccio storage directory in which every workspace package is published as `0.0.0-e2e-test-<timestamp>` under the `e2e-test` dist-tag. Installing from the snapshot means core's workspace dependencies resolve even when their versions are not on npmjs yet, as on a version-packages PR. `@mastra/mcp@1.17.3` is installed from its npmjs tarball URL, because the registry does not proxy `@mastra/*` packages to npmjs.

## Running it

CI runs this in the `E2E MCP compatibility` job, against the snapshot built by the `Publish E2E registry` job. Locally, get a snapshot first:

- Download the `e2e-verdaccio-registry` artifact from a recent CI run, for example `gh run download <run-id> -n e2e-verdaccio-registry -D /tmp/mastra-e2e-registry`.
- Or build one: `pnpm build`, then `pnpm install --frozen-lockfile && pnpm run publish-ci-registry` in `e2e-tests/_local-registry-setup`. This commits a `SAVEPOINT` and runs `git clean -fd` in the repository while it publishes, so commit or stash your work first.

Then run the consumers from the repository root:

```sh
MASTRA_E2E_REGISTRY_STORAGE=/tmp/mastra-e2e-registry/storage pnpm --filter @mastra/mcp test:compat
```

`compat.sh` starts Verdaccio through `with-registry.mjs`, runs this consumer and the `core-native` fixture in disposable directories, and stops the registry. The runner copies the fixture, installs with strict peers, typechecks, and runs an isolated HTTP server on an assigned port. It closes its own client and server. Generated manifests, lockfiles and installed packages belong only in the disposable consumer directory.

`pnpm --filter @mastra/mcp test:compat:version-packages` is the regression check for version-packages PRs. It adds a patch changeset for core's workspace dependencies, runs `pnpm changeset-cli version`, checks that the bumped versions are not on npmjs, and runs `compat.sh`. It rewrites the checkout, so outside GitHub Actions it only runs with `--force`; use a disposable checkout such as `git worktree add`.

## Assertions

The snapshot's core version (`0.0.0-e2e-test-*`) is outside MCP 1.x's `@mastra/core` peer range, so the consumer allows exactly that version for that one peer and keeps every other peer strict. `assert-core-peer-range.mjs` then checks that the checkout's real `packages/core` version satisfies the peer range declared by the installed `@mastra/mcp`.

The demo covers old core context/base exports, registration and global tool identity, discovery, tool invocation, nested tool context forwarding, legacy elicitation, and client logging.
