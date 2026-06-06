# Custom config directory

## Origin PR / commit

- PR: [#13751](https://github.com/mastra-ai/mastra/pull/13751) — adds `createMastraCode({ configDir })` so embedded/white-label consumers can use a project/global config directory other than `.mastracode`.
- Later changes: none known.

## User-visible behavior

- What the user can do: programmatic callers can pass a safe single directory name such as `.acme-code` to move Mastra Code project/global config lookup away from `.mastracode`.
- Success looks like: MCP, hooks, custom slash commands, skills, static agent instructions, resource-id overrides, and local storage paths all resolve through the configured directory, while Claude/Agent-compatible `.claude` and `.agents` paths still work.
- Must preserve: default `.mastracode` behavior, safe validation that rejects path traversal/absolute paths/separators, and consistent runtime `state.configDir` so dynamic workspace/tool paths match startup-initialized services.

## Entry points / commands

- Commands / shortcuts / flags: `createMastraCode({ configDir })`; no TUI slash command.
- Automatic triggers: startup validates the option, stores it in Harness state, and passes it to config/path loaders.

## TUI states

- Idle: TUI commands and dynamic tools read paths that were seeded from `state.configDir`.
- Active / modal / error: active runs use the same configured workspace/skills/instruction path set; invalid config names fail during startup before TUI use.

## Headless / non-TUI behavior

- Supported: headless and embedded callers use the same `createMastraCode()` option.
- Not supported / unknown: there is no CLI flag or settings UI for changing the directory.

## Streaming / loading / interrupted states

- Streaming / loading: the directory choice is fixed when the process creates Harness/workspace/services.
- Abort / retry / resume: retries keep the same Harness state/config paths; changing configDir requires a new `createMastraCode()` process.

## Streaming vs loaded-from-history behavior

- While actively streaming: dynamic workspace and static instruction ignore-list resolution use `state.configDir`.
- After reload / history reconstruction: persisted threads/resource IDs are read from storage/resource paths derived from the configured directory.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Config directory name | `MastraCodeConfig.configDir` defaulting to `DEFAULT_CONFIG_DIR` | startup path loaders, Harness initial state, dynamic workspace |
| Runtime config dir | `MastraCodeState.configDir` | workspace skill paths, dynamic tools, prompt context |
| Safety validation | `validateConfigDirName()` | `createMastraCode()` startup option validation |
| Project/global config paths | path loaders for MCP/hooks/slash commands/storage/instructions/skills | embedded consumers and default TUI/headless runtime |

## Key files

- `mastracode/src/constants.ts` — `DEFAULT_CONFIG_DIR` and safe single-directory validation.
- `mastracode/src/index.ts` — accepts `MastraCodeConfig.configDir`, validates it, stores `state.configDir`, and passes it to storage, MCP, hooks, and resource-id override loading.
- `mastracode/src/schema.ts` — persists `configDir` in the typed Mastra Code state schema.
- `mastracode/src/agents/workspace.ts` — builds skill/allowed paths from `state.configDir`.
- `mastracode/src/agents/prompts/agent-instructions.ts` — substitutes the config directory for project/global static instruction paths.
- `mastracode/src/utils/slash-command-loader.ts`, `mastracode/src/mcp/config.ts`, and `mastracode/src/hooks/config.ts` — load command/MCP/hook config from the selected directory.

## Dependencies / related features

- [Onboarding and global settings](./onboarding-and-global-settings.md) — global settings remain a separate settings file, while configDir controls project/global config path lookup.
- [MCP server configuration](../integrations/mcp-server-configuration.md) — MCP config files honor configDir.
- [Lifecycle hooks](../integrations/lifecycle-hooks.md) — hook config files honor configDir.
- [Queued follow-ups and slash commands](../chat/queued-followups.md) — custom command directories honor configDir.
- [Prompt context and project instructions](../chat/prompt-context.md) — static instruction locations honor configDir.
- [Skills command and workspace resolution](../integrations/skills-command.md) — skill paths honor configDir.

## Existing tests

- `mastracode/src/__tests__/validate-config-dir-name.test.ts` — valid/invalid config directory names.
- `mastracode/src/agents/__tests__/build-skill-paths.test.ts` — custom configDir skill path substitution and dedupe.
- `mastracode/src/__tests__/index.test.ts` — `createMastraCode({ configDir })` startup wiring keeps storage, MCP, hooks, resource-id override lookup, and runtime `state.configDir` aligned even when `initialState.configDir` conflicts.
- MCP/hooks/slash-command loader tests cover default path behavior; custom configDir integration coverage is partial.

## Missing tests

- End-to-end `createMastraCode({ configDir })` smoke test covering commands, instructions, and skills together.
- TUI/headless parity test that a non-default configDir survives thread reload and dynamic workspace rebuild.

## Known risks / regressions

- Startup services initialized with configDir must stay in sync with `state.configDir`; letting `initialState.configDir` override the option would split path ownership.
- Global instruction XDG substitution strips a leading dot for `.config/<name>` while direct home paths keep the dot, so callers need this distinction documented.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
