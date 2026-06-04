# Baseline: Mastra Code before Harness v1 compatibility

This document is the baseline for reviewing the Harness v1 / compatibility migration. It describes Mastra Code as it existed immediately before the Mastra Code Harness v1 adapter work, using the PR base `origin/feat/harness-v1-complete-core` as the reference point for Mastra Code.

The important baseline fact: Mastra Code already had a rich product surface before Harness v1. The Harness v1 migration was not just an internal harness swap; it had to preserve TUI behavior, headless behavior, thread behavior, tool approvals, subagents, memory, model/mode state, goals, hooks, MCP, browser tools, sandbox permissions, notifications, and storage semantics.

## Baseline top-level architecture

Before the Mastra Code adapter/runtime migration:

```text
mastracode/src/main.ts
  -> createMastraCode() from mastracode/src/index.ts
    -> legacy @mastra/core/harness Harness
      -> Agent
      -> Workspace
      -> Memory
      -> Storage
      -> Tools
      -> Modes
      -> Subagents
  -> MastraTUI or headless runner
```

`mastracode/src/index.ts` was the composition root. It imported `Harness` directly from `@mastra/core/harness`, built a `HarnessConfig<MastraCodeState>`, and returned a legacy harness instance to both the interactive TUI and headless mode.

There was no `mastracode/src/HarnessCompat.ts` bridge in the baseline Mastra Code tree. Compatibility state did not have to be composed from a separate v1 session layer. The TUI and headless code talked to a single harness abstraction.

## Baseline ownership model

The legacy Harness owned the runtime state that Mastra Code depended on:

- current thread
- current model
- current mode
- thread metadata
- active/pending run state
- tool approval suspension state
- sandbox access suspension state
- ask_user / submit_plan suspension state
- subagent execution plumbing
- task state through `MastraCodeState.tasks`
- `yolo`, permissions, thinking level, OM settings, browser settings, active plan, sandbox allowlist

The key architectural advantage was single ownership: `harness.getState()` was the state of record for TUI prompts, command handlers, dynamic instructions, dynamic tools, dynamic memory, model resolution, and event handlers.

Harness v1 compatibility therefore introduces a high-risk split-brain hazard: if v1 sessions own part of the state while the legacy-compatible surface owns another part, features can silently read stale values.

## Baseline entrypoints

### Interactive TUI

`mastracode/src/main.ts` selected interactive mode when no `--prompt`/headless flag was present.

Responsibilities:

- create Mastra Code runtime via `createMastraCode()`
- detect terminal theme
- create analytics
- instantiate `MastraTUI`
- process piped stdin as initial message
- manage cleanup on exit:
  - release thread locks
  - disconnect MCP
  - stop workers/heartbeats
  - close pubsub
  - shut down analytics

### Headless mode

`mastracode/src/headless.ts` was typed against legacy `Harness`, `HarnessEvent`, and `HarnessMessage` from `@mastra/core/harness`.

Baseline behavior included:

- `--prompt` / `-p`
- `--continue`
- `--thread`
- `--title`
- `--clone-thread`
- `--resource-id`
- `--timeout`
- `--format default|json`
- `--output-format text|json|stream-json`
- `--model`
- `--mode build|plan|fast`
- `--thinking-level off|low|medium|high|xhigh`
- `--settings`

Headless auto-resolved interactive events:

- sandbox access request -> approve
- tool approval required -> approve
- ask_user -> answer with best-judgment instruction
- plan approval -> approve

Any Harness v1 compatibility layer must preserve these event names, payloads, suspension/resume semantics, and response APIs.

## Baseline TUI architecture

`mastracode/src/tui/mastra-tui.ts` was the main class.

Core responsibilities:

- creates `TUIState`
- loads quiet-mode preferences
- routes keyboard input to active inline components before the editor
- handles image paste through `[image]` markers
- registers keyboard shortcuts
- runs SessionStart/SessionEnd hooks
- submits initial/piped messages
- handles updates/onboarding/auth prompts
- subscribes to harness events
- renders existing thread messages/tasks
- queues or signals follow-up messages while a run is active

The TUI expected the harness to expose a complete legacy-style interface:

- `getState()` / `setState()`
- `getCurrentThreadId()`
- `listThreads()`
- `switchThread()` / `createThread()` / clone behavior
- `switchMode()` / `getCurrentModeId()` / `listModes()`
- `hasModelSelected()`
- `sendMessage()` / signal submission
- `abort()` / `isRunning()`
- prompt/tool/sandbox/plan response APIs
- event subscription APIs

Any v1 session bridge must preserve those APIs and their timing. TUI code is event-driven and does not defensively re-derive state after every event.

## Baseline event flow

```text
User input
  -> MastraTUI editor submit
  -> slash command dispatch OR harness message/signal
  -> harness emits events
  -> tui/event-dispatch.ts
  -> tui/handlers/*
  -> pi-tui components + TUIState mutation
```

Important event categories:

- agent lifecycle: start/end/abort/error
- message start/update/end
- tool input/start/update/end
- shell output
- OM observation/reflection/buffering
- subagent lifecycle/tool lifecycle
- ask_user / submit_plan / request_access inline prompts
- sandbox access requests
- tool approval prompts
- thread changed/created events

Harness v1 regressions are likely when event payloads are equivalent-looking but not semantically identical, especially around suspension IDs, thread IDs, resource IDs, active-run state, and data part hydration.

## Baseline command system

`mastracode/src/tui/command-dispatch.ts` routed slash commands.

Baseline command surface included:

- `/new`, `/clone`, `/threads`, `/thread`
- `/skills`
- `/thread:tag-dir`
- `/sandbox`
- `/mode`, `/models`, `/custom-providers`
- `/subagents`
- `/om`, `/think`
- `/permissions`, `/yolo`
- `/settings`
- `/login`, `/logout`, `/api-keys`, `/memory-gateway`
- `/cost`, `/diff`, `/name`, `/resource`
- `/hooks`, `/mcp`, `/review`, `/report-issue`, `/setup`
- `/browser`, `/theme`, `/update`, `/feedback`, `/observability`
- `/goal`, `/judge`

Commands received a `SlashCommandContext` that included the harness, state, hook manager, MCP manager, analytics, auth storage, render helpers, and workspace resolver.

Compatibility risk: if `HarnessCompat` returns composed state differently than legacy Harness did, slash commands may mutate one owner and the runtime may read another.

## Baseline prompt/model/mode architecture

### Dynamic instructions

`src/agents/instructions.ts` built a prompt context from:

- project path/name
- git branch
- platform
- common binaries
- date
- active mode
- current model ID
- active plan
- working directory
- full harness state

Then `src/agents/prompts/index.ts` built the final system prompt from:

- base prompt
- mode prompt
- model-specific prompt
- task list injection
- AGENTS.md / CLAUDE.md instructions
- tool guidance

### Modes

Default modes were:

- `build`
- `plan`
- `fast`

Mode switching was a feature, not only a prompt change. Plan mode disabled write/edit tools through workspace configuration. Mode/model state had to stay aligned across the TUI footer, dynamic model resolver, dynamic instructions, and thread/session state.

Compatibility risk: preserving model across thread switch and keeping current mode state coherent are essential. The follow-up fixes around model preservation and fallback `switchMode` suggest this broke.

## Baseline model/auth architecture

`src/agents/model.ts` resolved model IDs dynamically from harness/request context.

Supported provider paths:

- Anthropic OAuth / API key
- OpenAI Codex OAuth / API key
- GitHub Copilot OAuth
- Cerebras, Google, DeepSeek env/API-key paths
- custom OpenAI-compatible providers from settings
- Mastra Gateway models

`src/auth/storage.ts` persisted credentials in app data `auth.json` and loaded stored API keys into `process.env` at startup.

Compatibility risk: v1 session state must preserve current model ID, subagent model IDs, thinking level, and provider history compatibility. Losing any of these can route to the wrong model or disable tool use.

## Baseline memory / OM architecture

`src/agents/memory.ts` created dynamic memory using harness state/request context.

State inputs included:

- `omScope`
- `observationThreshold`
- `reflectionThreshold`
- `cavemanObservations`
- `observeAttachments`
- observer model ID
- reflector model ID

The memory factory cached by OM configuration and used request context for dynamic observer/reflector models.

Compatibility risk: custom mode agents and subagents must get the same runtime memory/pubsub context. A later PR specifically fixed propagation, implying the initial runtime bridge broke this.

## Baseline workspace/tool architecture

`src/agents/workspace.ts` created a local workspace with:

- `LocalFilesystem`
- `LocalSandbox`
- LSP config
- skill paths
- package-runner detection
- default allowed paths including `/tmp` and OS temp
- thread/project sandbox allowlists

`src/tool-names.ts` remapped core workspace tool names to user-facing Mastra Code tool names:

- `view`
- `write_file`
- `string_replace_lsp`
- `find_files`
- `delete_file`
- `file_stat`
- `mkdir`
- `search_content`
- `ast_smart_edit`
- `execute_command`
- `get_process_output`
- `kill_process`
- `lsp_inspect`

`src/agents/tools.ts` dynamically added:

- `request_access`
- `notification_inbox`
- web search/extract
- MCP tools
- extra tools

Tools were wrapped by hooks and filtered through disabled tools/permission rules.

Compatibility risk: v1 built-in/canonical tools must not collide with Mastra Code’s remapped tool names. Tool result formats and approval events must remain compatible with TUI renderers.

## Baseline permissions and suspension flow

`src/permissions.ts` classified tools:

- `read`
- `edit`
- `execute`
- `mcp`

Default policy:

- read: allow
- edit: ask
- execute: ask
- mcp: ask

YOLO changed all categories to allow.

Suspensions existed for:

- tool approval
- sandbox access
- ask_user
- submit_plan

Compatibility risk: Harness v1 session permissions and suspension projection must preserve:

- selected question/approval IDs
- decision payload shape
- `selectionMode` for multi-select
- YOLO bypass behavior
- sandbox workspace context
- pending tool UI state

Several later fixes map exactly to these hazards.

## Baseline subagent architecture

Default subagents:

- `explore`: read-only, view/search/find
- `plan`: read-only planning
- `execute`: write/execute capable

Subagent model defaults were independently configurable. Legacy subagent output was expected by TUI subagent components and task/result renderers.

Compatibility risk: native v1 subagent spawning changes ownership and event flow. Later commits to keep v0 subagents out of v1 and preserve subagent model state indicate regressions around duplicate/wrong subagent implementations and model routing.

## Baseline goals

`src/tui/goal-manager.ts` implemented persistent goal mode.

State included:

- objective
- status
- turns used / max turns
- judge model ID
- started/active timing
- last judge failure state

The judge loop used workspace tools but should not mutate source. It persisted goal state to thread metadata.

Compatibility risk: thread metadata, current thread identity, and event timing must remain stable. If v1 sessions hide or re-scope metadata, goal resume/status behavior can break.

## Baseline storage/thread/resource architecture

`src/utils/project.ts` detected project identity from:

- git remote URL
- worktree main repo path
- absolute path fallback

Resource IDs grouped threads by project. Thread locks protected concurrent access unless a cross-process pubsub was configured.

`src/utils/storage-factory.ts` used:

- LibSQL by default
- optional Postgres with fallback to LibSQL
- separate vector DB for LibSQL recall search

Compatibility risk: Harness v1 sessions add their own persistence/session records. This can break startup if stale leases, project paths, resource IDs, or thread owner IDs do not align.

## Baseline MCP and hooks

MCP config was loaded from:

1. `.claude/settings.local.json`
2. global `~/.mastracode/mcp.json`
3. project `.mastracode/mcp.json`

`src/mcp/manager.ts` managed server connection state, tools, stderr logs, reload/reconnect, and OAuth storage.

`src/hooks/manager.ts` supported:

- `PreToolUse`
- `PostToolUse`
- `UserPromptSubmit`
- `Stop`
- `SessionStart`
- `SessionEnd`
- `Notification`

Compatibility risk: tool wrapping must remain at the exposed tool boundary. If v1 sessions execute tools through another path, hooks and permissions can be bypassed or double-fired.

## Baseline browser support

Browser settings lived in global settings and active state. The workspace/browser stack could expose browser automation tools. Browser state had to survive workspace reconciliation.

Compatibility risk: v1 workspace reconciliation can drop managed browser handles or active browser settings if it re-creates workspace/session structures without copying side-channel runtime state.

## Feature preservation checklist for every Harness v1 PR

For each PR in the migration stack, review whether it preserves:

1. Current model ID and mode ID across thread switches.
2. Dynamic instructions reading the same state the TUI mutates.
3. Dynamic memory receiving observer/reflector models and OM settings.
4. Subagent model routing and subagent output rendering.
5. Tool names, schemas, result shapes, and approvals.
6. YOLO and permission bypass semantics.
7. Sandbox access requests and allowed-path updates.
8. Ask-user single-select and multi-select projection.
9. Plan approval and active plan state.
10. Task list state and task rendering.
11. Thread metadata for titles, resources, GitHub signals, and goals.
12. Headless auto-approval and output formats.
13. Event ordering for TUI handlers.
14. MCP tool discovery and hooks wrapping.
15. Browser tool propagation and workspace reconciliation.
16. Thread lock / stale lease recovery.
17. Cross-process pubsub and signal delivery.
18. Message data part hydration, especially signals and attachments.

## High-risk migration thesis

Harness v1 is a deep runtime replacement. The compatibility layer is not a thin adapter; it has to project two different state/runtime models into one legacy-looking surface.

The most suspicious areas are:

- split state ownership between legacy harness state and v1 session state
- thread switch behavior
- session owner IDs
- subagent model and implementation routing
- prompt/tool runtime context propagation
- tool approval and suspension projection
- task state divergence
- signal/message data hydration
- event compatibility for TUI rendering

The follow-up fixes already found in the PR list confirm that many of these were real regressions, not hypothetical risks.
