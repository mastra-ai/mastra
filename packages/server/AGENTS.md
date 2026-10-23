Build from root: pnpm build:server
Test from root: pnpm test:server
If you change permissions, also run pnpm --filter ./packages/server generate:permissions and pnpm --filter ./packages/server check:permissions
If you add or change a route or its schemas, regenerate and commit the files generated from routes:

- pnpm --filter ./packages/server generate:route-types (writes client-sdks/client-js/src/route-types.generated.ts; then build @mastra/client-js to typecheck it)
- pnpm --filter ./packages/server generate:api-cli-route-metadata (writes packages/cli/src/commands/api/route-metadata.generated.ts)

Most validation is package-scoped tests plus build output
Permission and handler-contract changes need extra verification

Respect the package's subpath exports
