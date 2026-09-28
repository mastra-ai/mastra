Build from root: pnpm build:core
Test from root: pnpm test:core
Typecheck from root: pnpm --filter ./packages/core check
If focused core Vitest runs fail to resolve @internal/test-utils/setup, run pnpm build:core first so internal workspace build artifacts are available
If you change Zod compatibility behavior, also run pnpm test:core:zod and pnpm --filter ./packages/core typecheck:zod-compat

Most tests live under packages/core/src/
Run focused processor, harness, agent, or loop tests before broader validation when those areas change

Keep changes here surgical; many packages depend on core

When planning a change, aim for the smallest diff possible that still produces the simplest and most powerful DX outcome; prefer extending an existing extension point over adding new core API surface

Before adding a feature, check whether it can be a processor. Processors are self-contained and need no changes to core internals, so they carry far less risk of breaking existing behavior, and they can be registered automatically for all users rather than requiring each user to configure them

If a feature does need core processor API changes, land them in a separate PR first. They should be generally useful rather than shaped around one feature, should fit the existing processor API design, and require human approval — bot approval is not enough

Non-serializable per-run state (MessageList, processor states, converted tools) belongs in `runScope`, never on step input/output schemas; see `src/mastra/run-scope.ts`
