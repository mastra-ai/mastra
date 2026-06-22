Build from root: pnpm build:core
Test from root: pnpm test:core
Typecheck from root: pnpm --filter ./packages/core check
If focused core Vitest runs fail to resolve @internal/test-utils/setup, run pnpm build:core first so internal workspace build artifacts are available
If you change Zod compatibility behavior, also run pnpm test:core:zod and pnpm --filter ./packages/core typecheck:zod-compat

Most tests live under packages/core/src/
Run focused processor, harness, agent, or loop tests before broader validation when those areas change
For multi-step agentic-loop composition regressions (tool-result plumbing, cross-turn ordering, stop conditions) add BDD-style AIMock scenarios under src/loop/test-utils/aimock; see that dir's README.md

Keep changes here surgical; many packages depend on core

Mastra exposes a per-run scratch space (`runScope`) keyed by `runId` for non-serializable runtime state (MessageList, processor states, converted tools, loop options). Access it via `mastra.__createRunScope(runId)` / `__getRunScope(runId)` and typed `RunScopeKey<T>` keys from `mastra/run-scope.ts`. It is refcounted alongside `__registerInternalWorkflow`, never persisted, never published over pubsub, and dies with the run. Do not put runScope values on step input/output schemas — those cross the wire and must stay JSON-safe (Date/Error/Map/Set/GeneratedFile are handled by the codec at the `UnixSocketPubSub` boundary; live handles and closures are not).
