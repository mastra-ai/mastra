# Skills command and workspace resolution

## Origin PR / commit

- PR: [#13457](https://github.com/mastra-ai/mastra/pull/13457) — cache dynamic Harness workspace resolution so `/skills` works before the first message.
- Later changes: [#13460](https://github.com/mastra-ai/mastra/pull/13460) — the same autocomplete provider rebuild also receives `fdPath` for `@` file suggestions; [#13700](https://github.com/mastra-ai/mastra/pull/13700) — exposes computed skill paths through subagent allowed-path context so delegated agents can read installed skills; [#15151](https://github.com/mastra-ai/mastra/pull/15151) — adds Agent Skills spec-compatible `.agents/skills` project/global directories and updates `/skills` setup guidance; [#15228](https://github.com/mastra-ai/mastra/pull/15228) — resolves symlinked skill aliases to canonical paths so the same skill discovered through multiple directories is de-duplicated instead of treated as a conflicting duplicate; [#15566](https://github.com/mastra-ai/mastra/pull/15566) — replaces regex-heavy versioned skill path normalization with procedural parsing to avoid polynomial ReDoS in skill-source routing; [#16068](https://github.com/mastra-ai/mastra/pull/16068) — removed noisy startup output for non-existent skill directories by filtering logged directories, with current source having no unconditional `Skills loaded from:` startup log at all.
- Related origin: [#13227](https://github.com/mastra-ai/mastra/pull/13227) — introduced workspace-backed skill loading during early subagent/workspace organization.

## User-visible behavior

- What the user can do: run `/skills` to list invocable skills and `/skill/<name> [args]` to inject a specific skill's instructions into the current thread from Mastra Code, Claude, or Agent Skills spec directories.
- Success looks like: skills are available immediately at startup, even before any agent request has caused the dynamic workspace factory to resolve; delegated subagents can access the same skill directories as the parent workspace, including `.agents/skills` and `~/.agents/skills`; symlinked aliases of the same skill resolve to one canonical entry in `/skills`, prompt injection, search, and direct activation; startup does not print a noisy list of non-existent skill directories.
- Must preserve: `user-invocable: false` skills stay hidden, embedded `</skill>` text is escaped before injection, and skill-path filesystem access is inherited without granting arbitrary paths.

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
| Canonical skill identity | `WorkspaceSkillsImpl` + `SkillSource.realpath()` canonicalize skill directory paths before tie-breaking/list/search injection | duplicate-name resolution, search results, prompt skills processor |
| Skill path access | `buildSkillPaths(projectPath, configDir)` scans project/global Mastra Code, Claude, and Agent Skills spec directories; request-context allowed-path extraction mirrors those paths; `collectSkillPaths()` only touches existing directories for symlink expansion | parent and subagent filesystem/tools |

## Key files

- `packages/core/src/harness/harness.ts` — `buildRequestContext()` caches dynamic workspace and exposes `resolveWorkspace()` / `getWorkspace()`.
- `packages/core/src/harness/types.ts` — workspace config accepts static, config, or dynamic factory values.
- `mastracode/src/tui/commands/skills.ts` — eagerly resolves workspace for `/skills` and `/skill/<name>`.
- `mastracode/src/agents/workspace.ts` — `buildSkillPaths()` scans project/global Mastra Code, Claude, and Agent Skills directories, including `.agents/skills` and `~/.agents/skills`; `collectSkillPaths()` guards directory reads with `existsSync()` and current HEAD no longer emits the old top-level `Skills loaded from:` log.
- `packages/core/src/workspace/skills/workspace-skills.ts` and `skill-source.ts` — canonical-path de-duping for same-named skill candidates and the `realpath()` source contract.
- `packages/core/src/workspace/skills/local-skill-source.ts`, `composite-versioned-skill-source.ts`, `versioned-skill-source.ts` — symlink-aware local skill directory detection, canonical path passthrough/fallback for live/versioned sources, and procedural versioned path normalization.
- `packages/core/src/processors/processors/skills.ts` — formats deduped skills by path so prompt injection does not duplicate canonical aliases.
- `mastracode/src/tools/utils.ts` — `getAllowedPathsFromContext()` reuses skill paths for subagent/file-tool access.
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
- `mastracode/src/agents/__tests__/build-skill-paths.test.ts` — verifies project/global Mastra Code, Claude, and Agent Skills path construction plus symlink parent handling; current tests do not assert startup logging because the log path has since been removed.
- `mastracode/src/agents/__tests__/workspace-skill-activation.test.ts` — verifies symlinked local skills activate through the Mastra Code workspace path.
- `mastracode/src/tools/__tests__/get-allowed-paths.test.ts` — verifies skill paths are returned and merged with sandbox paths for inherited tool contexts.
- `packages/core/src/workspace/skills/workspace-skills.test.ts` — verifies canonical alias de-duping for list/search/get while preserving distinct same-named local skills as conflicts.
- `packages/core/src/workspace/skills/skill-versioning.test.ts` — covers versioned and composite skill-source path normalization/routing.
- `packages/core/src/workspace/filesystem/local-filesystem.test.ts`, `workspace.test.ts`, `tools.test.ts`, and `processors/processors/skills.test.ts` — cover symlink allowed roots, workspace skill discovery, tool activation, and prompt-processor de-duping around symlink aliases.

## Missing tests

- Direct `/skills` coverage for eager `resolveWorkspace()` when `getResolvedWorkspace()` is initially undefined.
- Goal skill aliases should eagerly resolve workspace when no prior message has run.
- Headless/non-TUI skill activation parity if expected.

## Known risks / regressions

- `isWorkspaceReady()` returns true for dynamic factories even before resolution; callers must still use `resolveWorkspace()`.
- Workspace factory failures now surface in command UI, but repeated failures can still leave skills unavailable until config is fixed.
- Dynamic workspace caching can become stale if the underlying skill config changes and no explicit reload path refreshes the workspace.
- Agent Skills spec directory support depends on keeping `/skills` setup guidance, `buildSkillPaths()`, and allowed-path extraction in sync.
- Canonical path de-duping depends on each `SkillSource` implementing `realpath()` consistently; sources without canonical resolution fall back to path-string tie-breaking and can still report duplicate same-named skills.
- Versioned skill path parsing should stay procedural/bounded; regex-based normalization can be reintroduced accidentally when adding new virtual source routing.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
