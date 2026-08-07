# @mastra/factory — AGENTS.md

Inherits from `mastracode/AGENTS.md`. Read [CONTEXT.md](./CONTEXT.md) for
vocabulary before touching factory code.

## Commands

- Build: `pnpm --filter ./mastracode/factory build`
- Test: `pnpm --filter ./mastracode/factory test`
- Typecheck: `pnpm --filter ./mastracode/factory check`
- Lint: `pnpm --filter ./mastracode/factory lint`

Colocated `*.test.ts` in `src/`.

## Rules

1. **Providers move in lockstep.** Any capability on `RailwaySandbox` must
   land on `PlatformSandbox` in the same shape, and vice versa. They are
   behaviourally interchangeable from the factory's point of view.

2. **Provider owns HOW, factory owns WHEN.** Providers expose transport
   (`captureCheckpoint()`, internal refresh timer). The factory decides
   when to call it (turn-end, session-idle, pre-teardown). Do not put
   scheduling logic in a provider. Do not put Railway HTTP details in
   the factory.

3. **Never fail a turn because a capture failed.** The turn-end hook logs
   and swallows. The provider's refresh is the fallback.

4. **Cache-hit does not re-subscribe.** In `workspace.ts`, per-session
   subscriptions (e.g. turn-end checkpoint) attach on Materialization only.
   Attaching on cache-hit produces duplicate subscribers.

5. **Feature-detect optional sandbox methods.** `captureCheckpoint()` is
   optional on `MaterializationSandbox`; `LocalSandbox` omits it. Callers
   must check for its presence.

6. **Say the package name.** `@mastra/railway`, not "Mastra Railway"
   (voice-dictation trap). "The OSS Railway provider" is fine.

7. **`RailwaySandboxProvisioner` is platform-only.** Do not reference it
   as if it lives in this repo. OSS `RailwaySandbox` calls Railway inline.

## Related repos

Platform-side code lives in the private `mastra-ai/platform` monorepo:

- workspace-proxy server: `servers/workspace-proxy/src/`
- `@platform/workspaces` service: `services/workspaces/src/`
- `RailwaySandboxProvisioner`: `services/workspaces/src/railway/sandbox-provisioner.ts`
- Checkpoint endpoint: `POST /v1/projects/:projectId/sandbox/:sandboxId/checkpoint`

Do not modify the platform repo from an OSS PR. Cross-repo work ships as
two PRs; cross-link them.
