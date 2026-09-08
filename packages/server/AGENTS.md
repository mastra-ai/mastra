Build from root: pnpm build:server
Test from root: pnpm test:server
If you change permissions, also run pnpm --filter ./packages/server generate:permissions and pnpm --filter ./packages/server check:permissions

Most validation is package-scoped tests plus build output
Permission and handler-contract changes need extra verification

Respect the package's subpath exports
