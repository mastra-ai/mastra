# Skills command and workspace resolution

## Origin PR / commit

- PR: [#13457](https://github.com/mastra-ai/mastra/pull/13457) — cache dynamic Harness workspace resolution so `/skills` works before the first message.
- Later changes: [#13460](https://github.com/mastra-ai/mastra/pull/13460) — the same autocomplete provider rebuild also receives `fdPath` for `@` file suggestions.
- Related origin: [#13227](https://github.com/mastra-ai/mastra/pull/13227) — introduced workspace-backed skill loading during early subagent/workspace organization.

## User-visible behavior

- What the user can do: run `/skills` to list invocable skills and `/skill/<name> [args]` to inject a specific skill's instructions into the current thread.
- Success looks like: skills are available immediately at startup, even before any agent request has caused the dynamic workspace factory to resolve.
- Must preserve: `user-invocable: false` skills stay hidden, and embedded `</skill>` text is escaped before injection.

## Entry points / commands

- Commands / shortcuts / flags: `/skills`, `/skill/<name>`, goal-skill command aliases.
- Automatic triggers: Harness `resolveWorkspace()` caches dynamic workspace factories; command handlers use the cached workspace or eagerly resolve it.

## TUI states

- Idle: `/skills` shows available skill names/descriptions or setup instructions.
- Active / modal / error: `/skill/<name>` sends a slash-command message; missing workspace/skill resolution errors are surfaced through `showError()`.

## Headless / non-TUI behavior

- Supported: the core Harness workspace APIs are TUI-independent.
- Not supported / unknown: slash-command skill activation is TUI command code; headless direct skill-command parity was not verified.

## Streaming / loading / interrupted states

- Streaming / loading: skill activation is a normal message injection; workspace resolution should already be cached for tools/request context after the first run.
- Abort / retry / resume: failed workspace resolution does not start an agent run; retrying `/skills` can reattempt resolution.

## Streaming vs loaded-from-history behavior

- While actively streaming: skill activation content is sent as a new message only when the command is processed.
- After reload / history reconstruction: prior skill activation appears as a persisted message; workspace availability for new `/skills` calls is resolved from current config.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Workspace instance | Core Harness `workspace` cache | Slash commands, request context, agents/tools |
| Dynamic workspace factory | Harness config `workspace` function | `buildRequestContext()`, `resolveWorkspace()` |
| Skill catalog | Workspace skills provider | `/skills`, `/skill/<name>`, goal skill aliases |

## Key files

- `packages/core/src/harness/harness.ts` — `buildRequestContext()` caches dynamic workspace and exposes `resolveWorkspace()` / `getWorkspace()`.
- `packages/core/src/harness/types.ts` — workspace config accepts static, config, or dynamic factory values.
- `mastracode/src/tui/commands/skills.ts` — eagerly resolves workspace for `/skills` and `/skill/<name>`.
- `docs/src/content/en/reference/harness/harness-class.mdx` — documents Harness workspace methods.

## Dependencies / related features

- [Core Harness API](./harness-api.md) — workspace methods are part of the public Harness surface.
- [Delegation](../subagents/delegation.md) — workspace/skills setup came from the same early organization work.
- [Prompt context](../chat/prompt-context.md) — activated skill content becomes agent-visible instruction context.
- [Workspace-backed coding tools](../tools/workspace-tools.md) — workspace owns skill paths used by the skills provider.
- [File autocomplete](../tui/file-autocomplete.md) — file and skill suggestions share `setupAutocomplete()` provider rebuilds.

## Existing tests

- `packages/core/src/harness/workspace-resolution.test.ts` — verifies static/dynamic/no-workspace paths and dynamic cache behavior.
- `mastracode/src/tui/commands/__tests__/skills.test.ts` — verifies `/skill/<name>` activation, missing-skill hints, hidden skills, and XML boundary escaping.

## Missing tests

- Direct `/skills` coverage for eager `resolveWorkspace()` when `getResolvedWorkspace()` is initially undefined.
- Goal skill aliases should eagerly resolve workspace when no prior message has run.
- Headless/non-TUI skill activation parity if expected.

## Known risks / regressions

- `isWorkspaceReady()` returns true for dynamic factories even before resolution; callers must still use `resolveWorkspace()`.
- Workspace factory failures now surface in command UI, but repeated failures can still leave skills unavailable until config is fixed.
- Dynamic workspace caching can become stale if the underlying skill config changes and no explicit reload path refreshes the workspace.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
