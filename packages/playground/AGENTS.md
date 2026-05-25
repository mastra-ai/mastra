Build from root: pnpm --filter ./packages/playground build
Test from root: pnpm --filter ./packages/playground test:e2e
If setup is needed first, run pnpm --filter ./packages/playground test:e2e:setup

This package is primarily validated with E2E coverage
Treat changes here as product-behavior changes

Coordinate with packages/playground-ui when a change crosses app and component-library boundaries
