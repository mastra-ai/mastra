# Published MCP 1.x compatibility

This consumer installs published `@mastra/mcp@1.17.3` with a packed core build. It does not import workspace source or the workspace MCP package.

From the repository root, `pnpm build:core` and then `pnpm --filter @mastra/mcp test:compat` packs core and runs this consumer plus the `core-native` fixture (CI runs the same script in the `E2E MCP compatibility` job). To run it by hand, pack core and pass its tarball and a new consumer directory:

```sh
pnpm build:core
pnpm --filter ./packages/core pack --pack-destination /tmp/core-compat-artifacts
bash packages/mcp/integration-tests/published-v1/run.sh /tmp/core-compat-artifacts/mastra-core-1.66.0.tgz /tmp/core-compat-consumer
```

Use the filename produced by `pack` if core's version changes. The destination must not exist. The runner copies this fixture, installs with strict peers, typechecks, and runs an isolated HTTP server on an assigned port. It closes its own client and server.

Assertions cover old core context/base exports, registration and global tool identity, discovery, tool invocation, nested tool context forwarding, legacy elicitation, and client logging. The legacy SDK client is pinned to `1.29.0`. Generated manifests, lockfiles, tarballs and installed packages belong only in the disposable consumer directory.
