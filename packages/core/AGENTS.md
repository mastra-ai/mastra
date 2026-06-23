Build from root: pnpm build:core
Test from root: pnpm test:core
Typecheck from root: pnpm --filter ./packages/core check
If focused core Vitest runs fail to resolve @internal/test-utils/setup, run pnpm build:core first so internal workspace build artifacts are available
If you change Zod compatibility behavior, also run pnpm test:core:zod and pnpm --filter ./packages/core typecheck:zod-compat

Most tests live under packages/core/src/
Run focused processor, harness, agent, or loop tests before broader validation when those areas change

Keep changes here surgical; many packages depend on core
