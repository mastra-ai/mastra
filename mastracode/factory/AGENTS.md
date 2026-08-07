# @mastra/factory — AGENTS.md

Inherits from `mastracode/AGENTS.md`. Read [CONTEXT.md](./CONTEXT.md) for
vocabulary before touching factory code.

## Commands

- Test: `pnpm --filter ./mastracode/factory test`
- Typecheck: `pnpm --filter ./mastracode/factory check`
- Lint: `pnpm --filter ./mastracode/factory lint`

Colocated `*.test.ts` in `src/`.

## Rules

1. **Providers move in lockstep.** Any capability on `RailwaySandbox`
   must land on `PlatformSandbox` in the same shape, and vice versa.

2. **Provider owns HOW, factory owns WHEN.** Providers own transport
   (`captureCheckpoint()`, refresh timer). The factory decides when to
   call it (turn-end, session-idle, teardown). No scheduling in a
   provider; no Railway HTTP in the factory.

3. **Never fail a turn because a capture failed.** The turn-end hook
   logs and swallows. The provider's refresh is the fallback.

4. **Cache-hit does not re-subscribe.** Per-session subscriptions in
   `workspace.ts` attach on Materialization only.

5. **Feature-detect optional sandbox methods.** `captureCheckpoint()`
   is optional on `MaterializationSandbox`.

6. **Say the package name.** `@mastra/railway`, not "Mastra Railway".

7. **`RailwaySandboxProvisioner` is platform-only.** OSS
   `RailwaySandbox` calls Railway inline; there is no OSS provisioner.

## Related repos

Platform-side code lives in the private `mastra-ai/platform` monorepo:
`servers/workspace-proxy/`, `services/workspaces/` (contains
`RailwaySandboxProvisioner`). Cross-repo work ships as two PRs.
