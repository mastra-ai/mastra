Build from root: pnpm --filter ./packages/mcp build:lib
Test from root: use the narrowest applicable suite: pnpm --filter ./packages/mcp test:client, pnpm --filter ./packages/mcp test:server, or pnpm --filter ./packages/mcp test:integration

This package splits client, server, and integration coverage
Prefer the narrowest suite over running everything

Keep client, server, and shared protocol concerns separate
