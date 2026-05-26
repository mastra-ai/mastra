# MastraCode Harness v1 Feature PR Audit

Audit of recent MastraCode feature PRs against PR #16943 (`feat(mastracode): run on Harness v1 runtime`).

## Audit scope correction — 2026-05-25

The initial queue was too broad because it was discovered with `git log --all`, which includes commits reachable from every local/remote ref, not just PR #16943's branch.

Correct inclusion rule from this point forward:

- **Audit only commits/PRs reachable from current `HEAD`** (`feat/mastracode-harness-v1-runtime`).
- Mark `origin/main`-only commits as **branch drift**; do not audit them as already covered by this PR until this branch is rebased/updated.
- Mark commits only reachable from unrelated feature branches as **out of scope**.

Evidence:

```bash
# This branch is behind main
git rev-list --left-right --count origin/main...HEAD
# 24 124

# Experimental Subconscious is not in this PR or main; it is only on another feature branch
git branch -a --contains 2e8b13215a
# devin/1778543030-mastracode-subconscious-opt-in
# remotes/origin/devin/1778543030-mastracode-subconscious-opt-in
```

Known exclusions from the original provisional queue:

- Custom config directory (#13751) — **branch drift**, reachable from `origin/main` but not current `HEAD`.
- #17005 and #17008 — **branch drift**, reachable from `origin/main` but not current `HEAD`.

## Corrected audit queue — HEAD-reachable only

Ordered by Harness v1 runtime compatibility risk. Checkpoints already written for #16231 and #16065 remain valid because both commits are reachable from `HEAD`.

1. #16231 — `feat(mastracode): send follow-ups through Agent signals` — **audited; needs fix**.
2. #16065 — `feat(mastracode): add /goal slash command for persistent cross-turn goals` — **audited; needs fix**.
3. #16676 — `feat(mastracode): return to plan after approved goal` — **audited; likely works with caveat**.
4. #16618 — `feat(mastracode): add /skill/<name> command to activate skills explicitly` — **audited; likely works with caveat**.
5. #16771 — `feat(mastracode): add quiet mode` — **audited; works**.
6. #16682 / #16275 / #16922 — `/om` toggles for attachment observation, caveman observations, and provider-capability auto mode — **audited; likely works with caveat**.
7. #16548 — Codex device login and MCP OAuth config — **audited; works with caveat**.
8. #16129 — GitHub Copilot OAuth provider with live model discovery — **audited; works with caveat**.
9. #13891 — custom memory instance override — **audited; needs fix for custom mode agents**.
10. #16094 — `/tmp` as default allowed workspace path — **audited; blocked by shared-workspace RequestContext regression (Finding A)**.
11. #16006 / #14962 / #14909 — headless stdin, thread control, and model CLI options — **audited; likely works with caveat (blocked by Finding A for default workspace turns)**.
12. #15036 — browser automation support — **audited; works with caveat**.
13. #14845 — custom response on questions with options — **audited; works with caveat**.
14. #14377 — interactive `/mcp` selector — **audited; works with caveat**.
15. #13999 / #13437 — shell passthrough/workspace tool streaming — **audited; needs fix for v1 workspace tool streaming**.

## Checkpoint 1 — PR #16231: `feat(mastracode): send follow-ups through Agent signals`

**Verdict:** needs fix before continuing or before claiming full compatibility.

### Original feature behavior

PR #16231 moved while-active user follow-ups/interjections onto Agent signals:

- TUI sends active user input via `harness.sendSignal()` with:
  - `ifActive.attributes.delivery = 'while-active'`
  - `ifIdle.attributes.delivery = 'message'`
- TUI renders while-active signal messages with the `steer` label.
- Signal content can include image/file parts.
- Restored thread history should preserve enough signal metadata/content for replayed UI rendering.

### Harness v1 runtime path traced

Current v1 runtime preserves the live send path:

- `mastracode/src/tui/mastra-tui.ts:393` and `:425` send user signal content + delivery attributes.
- `mastracode/src/harness/runtime.ts:1017-1048` forwards those to `session.signal()`.
- `packages/core/src/harness/v1/session.ts:5126-5288` routes idle vs active delivery correctly:
  - idle wakes a run with `ifIdle.attributes`
  - active interleaves into current run with `ifActive.attributes`
- `MastraCodeHarnessRuntime.sendMessage()` also uses v1's signal-routed `session.message()` path.

### Issue found

Persisted user-message signal conversion in the v1/runtime history path drops signal attributes and non-text content.

`mastracode/src/harness/runtime.ts:233-235` uses `convertStoredMessageToHarnessMessage(message)`, but `packages/core/src/harness/_shared/message-conversion.ts:126-133` maps user-message signals to only:

```ts
{ type: 'text', text: typeof contents === 'string' ? contents : textFromParts() }
```

and returns no `attributes`.

That loses two pieces PR #16231 depends on during thread reload/history rendering:

1. `delivery: 'while-active'` is dropped, so `mastracode/src/tui/render-messages.ts:42-44` can't render the `steer` label.
2. image/file signal content is dropped, even though legacy conversion preserves it via `signalContentsToHarnessContent()` in `packages/core/src/harness/harness.ts:107-131` and preserves attributes at `packages/core/src/harness/harness.ts:2046-2058`.

This affects `renderExistingMessages()` on initial load/thread switch (`mastracode/src/tui/render-messages.ts:561-583`).

### Evidence/tests run

Passing focused tests:

```bash
pnpm --filter ./mastracode test src/tui/__tests__/mastra-tui-queueing.test.ts src/tui/handlers/__tests__/message.test.ts -- --bail 1 --reporter=dot
# 40 passed

pnpm test packages/core/src/harness/v1/session.signal.test.ts packages/core/src/harness/v1/session.message.test.ts packages/core/src/harness/v1/list-messages.test.ts -- --bail 1 --reporter=dot
# 72 passed, no type errors

pnpm --filter ./mastracode test src/harness/runtime.test.ts -- --bail 1 --reporter=dot
# 30 passed
```

Existing tests cover live routing, but not v1 history replay preserving signal attributes/files.

### Recommended fix

Update `convertStoredMessageToHarnessMessage()` to handle `signal.type === 'user-message'` like legacy does:

- Convert structured `signal.contents` arrays into `text` / `image` / `file` `HarnessMessageContent`.
- Return `attributes` from `signal.attributes`.

Add focused tests in `packages/core/src/harness/v1/list-messages.test.ts` for:

- persisted user-message signal with `{ attributes: { delivery: 'while-active' } }`
- persisted user-message signal with `contents: [{ type: 'text' }, { type: 'file', mediaType: 'image/png', data }]`

---

## Checkpoint 2 — PR #16065: `feat(mastracode): add /goal slash command for persistent cross-turn goals`

**Verdict:** needs fix / deeper validation before claiming full compatibility.

### Original feature behavior

PR #16065 added the TUI-owned persistent goal loop:

- `/goal <objective>` creates a thread-persisted goal with judge model + max-turn settings.
- After each successful `agent_end`, `maybeGoalContinuation()` asks `GoalManager.evaluateAfterTurn()` whether the goal is done, should continue, or should wait.
- User-queued follow-ups/slash commands preempt goal continuations.
- Continue decisions send the next nudge as a `system-reminder` signal with `type: 'goal-judge'`.
- Terminal judge decisions (`done` / `waiting` / paused/no continuation) are persisted as system-reminder history without starting another agent turn.
- Goal state is stored in thread metadata (`goal`) and restored on startup/thread switch.

### Harness v1 runtime path traced

The current PR #16943 path keeps the TUI `GoalManager` as the active MastraCode goal controller; it does **not** route TUI `/goal` through the new core v1 `Session.setGoal()` API.

Relevant compatibility bridge points:

- `mastracode/src/tui/handlers/agent-lifecycle.ts:216-333` still performs post-turn judge evaluation and continuation scheduling.
- `mastracode/src/tui/handlers/agent-lifecycle.ts:269-287` sends goal continuations through `state.harness.sendSignal({ type: 'system-reminder', ... })`.
- `mastracode/src/harness/runtime.ts:1017-1031` maps that to `session.injectSystemReminder()`.
- `mastracode/src/tui/goal-manager.ts:158-163` persists goal state through `setThreadSetting({ key: 'goal', value })`.
- `mastracode/src/harness/runtime.ts:727-734` delegates `setThreadSetting()` to v1 thread settings.
- `mastracode/src/tui/mastra-tui.ts:107-117` and `mastracode/src/tui/event-dispatch.ts:144-170` restore `goal` metadata on startup/thread switch.
- `mastracode/src/harness/runtime.ts:1114-1143` implements the new optional `saveSystemReminderMessage()` used for terminal goal judge history.

Core Harness v1 has its own goal API and tests (`packages/core/src/harness/v1/session.goal.test.ts`, `session.goal-judge.test.ts`), but the TUI compatibility path above is what matters for PR #16065 behavior.

### Issue found

`MastraCodeHarnessRuntime.saveSystemReminderMessage()` uses `session.injectSystemReminder()` to persist terminal goal judge messages:

- `mastracode/src/harness/runtime.ts:1127-1136`

But `Session.injectSystemReminder()` is explicitly a wake/interleave primitive, not a persist-only primitive:

- `packages/core/src/harness/v1/session.ts:5291-5299` documents that idle reminders wake a run and perform full turn bookkeeping.
- `packages/core/src/harness/v1/session.ts:5325-5409` confirms the idle path begins a turn, emits `agent_start`, sends the signal with `ifIdle: { behavior: 'wake' }`, waits for run completion, emits `agent_end`, and runs the v1 goal judge.

That conflicts with the TUI goal path at `mastracode/src/tui/handlers/agent-lifecycle.ts:291-301`, where `saveSystemReminderMessage()` is used only to persist/display the final judge result when no continuation should run.

Likely regression:

- A `waiting` or `done` goal judge result may unintentionally wake the agent with the terminal judge text.
- For `waiting`, `GoalManager.evaluateAfterTurn()` does not mark the goal paused/done (`mastracode/src/tui/goal-manager.ts:294-298`), so the extra agent turn can re-trigger `maybeGoalContinuation()` and disturb the intended "wait for user checkpoint" state.
- Existing tests mock `saveSystemReminderMessage()` at the TUI layer and only assert that runtime persistence creates a system-reminder message; they do not assert that persistence is side-effect-free.

### Evidence/tests run

Passing focused tests:

```bash
pnpm --filter ./mastracode test src/tui/__tests__/goal-manager.test.ts src/tui/commands/__tests__/goal.test.ts src/tui/__tests__/mastra-tui-queueing.test.ts src/harness/runtime.test.ts -- --bail 1 --reporter=dot
# 4 files passed, 99 tests passed

pnpm test packages/core/src/harness/v1/session.goal.test.ts packages/core/src/harness/v1/session.goal-judge.test.ts packages/core/src/harness/v1/session.signal.test.ts -- --bail 1 --reporter=dot
# 3 files passed, 44 tests passed, no type errors
```

Coverage gap: no focused test currently asserts that `MastraCodeHarnessRuntime.saveSystemReminderMessage()` persists a terminal goal judge message without starting an agent turn / emitting `agent_start`.

### Recommended fix

Make `saveSystemReminderMessage()` persist-only. Do not call `session.injectSystemReminder()` for terminal history writes.

Smallest likely fix:

- Add a v1 Session/core helper that persists a system-reminder signal/message to memory without `ifIdle: { behavior: 'wake' }`, or implement direct memory persistence in `MastraCodeHarnessRuntime.saveSystemReminderMessage()` using the same stored-message shape that `_persistSystemReminderSignal()` writes.
- Add a runtime test that subscribes to runtime events, calls `saveSystemReminderMessage()` while idle, verifies the system-reminder appears in `listMessages()`, and verifies no `agent_start` / `agent_end` event is emitted.

---

## Checkpoint 3 — PR #16676: `feat(mastracode): return to plan after approved goal`

**Verdict:** likely works with caveats already captured by Checkpoint 2.

### Original feature behavior

PR #16676 made goals started from a plan approval return to Plan mode automatically after that exact goal is judged done:

- The plan approval UI's `Use as /goal` path approves the submitted plan, starts a goal whose objective is `# {title}\n\n{plan}`, then records the created goal id in `state.planStartedGoalId`.
- Normal/manual goals should not switch modes when done.
- `waiting` and `paused` judge decisions should not switch modes.
- Replaced/cleared goals should clear stale plan-start tracking.
- If switching back to Plan mode fails, `planStartedGoalId` is restored so the UI can retry/report accurately.

### Harness v1 runtime path traced

The current PR #16943 path preserves the TUI-owned control flow:

- `mastracode/src/tui/handlers/prompts.ts:366-379` handles `Use as /goal`: `approvePlan()` → `ctx.startGoal()` → stores `state.planStartedGoalId = goal.id`.
- `mastracode/src/harness/runtime.ts:1435-1451` maps `respondToPlanApproval()` to `session.respondToPlanApproval()`.
- `packages/core/src/harness/v1/session.ts:6484-6504` resumes the v1 `plan-approval` pending item and supports the plan-mode transition from the frozen `transitionsTo` target.
- `mastracode/src/harness/config.ts:100-106` maps legacy Plan mode to v1 mode metadata with `transitionsTo` set to the default mode when default mode is not Plan.
- `mastracode/src/tui/handlers/agent-lifecycle.ts:310-318` checks terminal judge result `done` and matching `planStartedGoalId`, then calls `state.harness.switchMode({ modeId: 'plan' })`.
- `mastracode/src/harness/runtime.ts:814-828` implements that switch on v1 by aborting if needed, calling `session.switchMode({ mode: 'plan' })`, persisting `currentModeId` in thread settings, and loading the plan-mode model.
- `packages/core/src/harness/v1/session.ts:5569-5577` durably updates the session mode and emits `mode_changed`.

### Compatibility notes

The direct #16676 behavior appears compatible with the v1 runtime adapter: plan approval resumes through v1, the goal loop remains TUI-owned, and the return-to-plan step uses the adapter's `switchMode()` path.

Caveats:

1. This checkpoint depends on the Checkpoint 2 issue: terminal goal judge results call `saveSystemReminderMessage()`, which currently uses the wake/interleave `session.injectSystemReminder()` path. That can introduce an unwanted extra turn before/around the return-to-plan flow.
2. `planStartedGoalId` is TUI process state, not thread metadata. That matches the PR's current implementation, but means return-to-plan intent is not restored after a restart in the middle of a plan-started goal. Not a new v1 regression by itself, but still a resilience gap.

### Evidence/tests run

Passing focused tests:

```bash
pnpm --filter ./mastracode test src/tui/__tests__/mastra-tui-queueing.test.ts src/tui/handlers/__tests__/prompts.test.ts src/tui/commands/__tests__/goal.test.ts src/harness/runtime.test.ts -- --bail 1 --reporter=dot
# 4 files passed, 80 tests passed

pnpm test packages/core/src/harness/v1/session.builtin-tools.test.ts packages/core/src/harness/v1/session.goal.test.ts packages/core/src/harness/v1/session.goal-judge.test.ts -- --bail 1 --reporter=dot
# 3 files passed, 42 tests passed, no type errors
```

Coverage gap: no single integration test exercises the full path with a real `MastraCodeHarnessRuntime`: `plan approval` → `Use as /goal` → terminal judge `done` → `switchMode('plan')`. Current coverage is split between TUI unit mocks and v1 core/session tests.

### Follow-up

No new #16676-specific blocker found beyond the Checkpoint 2 terminal-system-reminder issue. Recommended follow-up is an integration test around the full plan-started-goal completion path after `saveSystemReminderMessage()` is made persist-only.

---

## Checkpoint 4 — PR #16618: `feat(mastracode): add /skill/<name> command to activate skills explicitly`

**Verdict:** likely works with caveat: blocked by the live-smoke workspace-state regression if `projectPath` is missing from the v1 request context.

### Original feature behavior

PR #16618 added explicit skill activation from the TUI:

- `/skill/<name>` resolves a user-invocable workspace skill, formats its instructions with `formatSkillActivation(skill)`, optionally appends arguments, and sends it as a `<skill name="...">...</skill>` slash-command message.
- `/skills` lists user-invocable skills and hides internal/non-user-invocable skills.
- Skill autocomplete is populated from the resolved workspace and refreshed lazily after startup.
- Render replay recognizes persisted `<skill>` XML, dedupes optimistic slash-command components, and unescapes encoded `</skill>` boundaries.

### Harness v1 runtime path traced

The current v1 adapter preserves the intended send/render shape:

- `mastracode/src/tui/commands/skills.ts` resolves the workspace via `ctx.getResolvedWorkspace()`, filters with `isUserInvocable()`, calls shared `formatSkillActivation(skill)`, escapes `</skill>`, then calls `sendSlashCommandMessage()` with `renderIdleUserMessage: false`.
- `mastracode/src/tui/send-slash-command-message.ts` sends active-thread skill activation via `harness.sendSignal({ content })`; idle-thread activation goes through `harness.sendMessage({ content })`.
- `mastracode/src/harness/runtime.ts:1017-1048` forwards active skill slash messages to `session.signal()` as user-message signals.
- `mastracode/src/harness/runtime.ts:1051-1071` forwards idle skill slash messages to `session.message()` after `ensureSessionState()` / `syncSessionControls()`.
- `mastracode/src/harness/runtime.ts` caches/resolves the current v1 workspace via `session.getWorkspace()` so skill discovery and autocomplete can use the Harness v1 workspace provider.
- `packages/core/src/harness/v1/session.ts:2124-2127` exposes `getWorkspace()`, and `_buildRequestContext()` includes the resolved workspace plus Harness state in the request context.
- `mastracode/src/tui/render-messages.ts:390-415` renders echoed or restored `<skill>` messages as `SlashCommandComponent`s.

### Compatibility notes

No new #16618-specific Harness v1 adapter issue was found. The feature mostly depends on two already-audited surfaces:

1. **Workspace state plumbing.** `/skill` and skill autocomplete require `session.getWorkspace()`. The live-smoke Finding A shows the current branch can call `getDynamicWorkspace()` with no `state.projectPath`, producing `Error: Project path is required`. That would also break `/skill` resolution/autocomplete until the workspace-state regression is fixed.
2. **Active slash-command signal history.** When `/skill` is sent during an active run it uses `sendSignal({ content })`. The Checkpoint 1 converter issue can affect restored/history rendering for active signal messages, though this path does not rely on the `delivery: 'while-active'` label because `sendSlashCommandMessage()` does not pass the TUI `USER_SIGNAL_DELIVERY_OPTIONS` attributes.

### Evidence/tests run

Passing focused tests:

```bash
pnpm --filter ./mastracode test src/tui/commands/__tests__/skills.test.ts src/tui/__tests__/command-dispatch.test.ts src/tui/__tests__/render-messages.test.ts src/tui/__tests__/setup-keyboard-shortcuts.test.ts src/agents/__tests__/workspace-skill-activation.test.ts -- --bail 1 --reporter=dot
# 5 files passed, 56 tests passed

pnpm test packages/core/src/workspace/skills/tools.test.ts packages/core/src/workspace/skills/workspace-skills.test.ts packages/core/src/workspace/skills/schemas.test.ts packages/core/src/harness/v1/session.signal.test.ts -- --bail 1 --reporter=dot
# 4 files passed, 199 tests passed, no type errors

pnpm --filter ./mastracode test src/harness/runtime.test.ts -- --bail 1 --reporter=dot
# 1 file passed, 30 tests passed
```

Coverage gap: there is no single integration test for `MastraCodeHarnessRuntime` + real workspace + `/skill/<name>` command. Existing coverage is split between TUI command mocks, core workspace skill tests, and runtime signal/message tests.

### Follow-up

Fix live-smoke Finding A first, then add a focused runtime/TUI integration test proving that a v1 runtime initialized with `initialState.projectPath` can resolve workspace skills and send `/skill/<name>` successfully.

---

## Checkpoint 5 — PR #16771: `feat(mastracode): add quiet mode`

**Verdict:** works for Harness v1 compatibility. No v1-runtime blocker found.

### Original feature behavior

PR #16771 added a TUI quiet-mode rendering preference:

- `quietMode` and `quietModeMaxToolPreviewLines` are persisted in global settings.
- Tool components render as compact summaries when quiet mode is enabled, with preview lines clamped to 0–8.
- Existing tool/message history is re-rendered with quiet-mode compact display on startup/thread switch.
- Task progress uses the pinned `TaskProgressComponent` and compact quiet formatting.
- Chat boundary spacers reconcile adjacent compact tool groups.

### Harness v1 runtime path traced

Quiet mode is a display preference, not a Harness state or session feature:

- `mastracode/src/onboarding/settings.ts` persists and normalizes `quietMode` / `quietModeMaxToolPreviewLines` independently of Harness v1 session state.
- `mastracode/src/tui/mastra-tui.ts` loads those settings into `TUIState` during startup.
- Live tool rendering consumes legacy-projected v1 events:
  - v1 emits `tool_input_start` / `tool_input_delta` / `tool_start` / `tool_end` / `task_updated` from `_drainStreamToEvents()`.
  - `MastraCodeHarnessEventProjector` passes the relevant event shapes through and appends `display_state_changed`.
  - `MastraCodeHarnessRuntime.getDisplayState()` exposes `activeTools`, `toolInputBuffers`, `tasks`, and `previousTasks` from the v1 session/display state.
  - TUI handlers apply quiet mode to `ToolExecutionComponentEnhanced` and `TaskProgressComponent` using local `TUIState`.
- History replay remains compatible because `renderExistingMessages()` consumes `harness.listMessages()`, and the shared v1 message converter preserves assistant `tool_call` / `tool_result` parts needed to reconstruct compact tool components.

### Compatibility notes

No new #16771-specific adapter issue was found. The feature is mostly insulated from Harness v1 because quiet mode lives in settings and UI component state. It depends only on generic tool/task event projection and message-history conversion, both of which are already present in PR #16943.

The existing live-smoke Finding A (`projectPath` missing from dynamic workspace state) can still prevent any tool run from starting, which would indirectly prevent quiet-mode tool display from being exercised in a real TUI session. That is not a quiet-mode compatibility issue; it is the broader workspace-state regression already logged below.

### Evidence/tests run

Passing focused tests:

```bash
pnpm --filter ./mastracode exec vitest run src/tui/__tests__/mastra-tui-quiet-mode.test.ts src/tui/__tests__/render-messages.test.ts src/harness/runtime.test.ts --bail 1 --reporter=dot
# 3 files passed, 52 tests passed

pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/tool-execution-enhanced.test.ts src/tui/components/__tests__/task-progress.test.ts src/tui/components/__tests__/chat-boundary-spacer.test.ts src/tui/handlers/__tests__/message.test.ts --bail 1 --reporter=dot
# 4 files passed, 92 tests passed
```

Coverage gap: no full live TUI smoke was rerun with quiet mode enabled because the branch currently has the separate first-message workspace-state regression. Unit/runtime coverage is sufficient to classify quiet mode itself as v1-compatible.

### Follow-up

No quiet-mode-specific fix needed. After fixing live-smoke Finding A, manually smoke one real tool call with quiet mode enabled to verify compact tool display in the real TUI.

---

## Checkpoint 6 — PR #16682 / #16275 / #16922: `/om` attachment/caveman toggles and provider-capability auto mode

**Verdict:** likely works with caveat. No new Harness v1 runtime blocker found.

### Original feature behavior

This HEAD-reachable OM feature group added MastraCode-owned OM configuration toggles:

- #16275 adds `cavemanObservations`, changing observer/reflection instructions for terse OM output.
- #16682 adds `observeAttachments` with `auto` / `on` / `off`, controlled by `/om` and persisted in settings/thread metadata.
- #16922 adds provider capability data and `auto` behavior so text-only observer models can skip attachment parts.

### Harness v1 runtime path traced

The live runtime path is compatible with v1 session state and request context:

- `mastracode/src/index.ts:524-652` seeds `cavemanObservations` and `observeAttachments` into `MastraCodeHarnessRuntime.initialState` from global settings.
- `mastracode/src/harness/runtime.ts:1776-1782` persists runtime state into the active v1 session before turns via `session.setState(this.state)`.
- v1 `Session._buildRequestContext()` exposes `state` / `getState()` on the harness request-context slot (`packages/core/src/harness/v1/session.ts:9684-9783`).
- `mastracode/src/agents/memory.ts:82-128` reads both flags from that request context, changes the OM memory cache key, sets caveman instructions, and forwards `observeAttachments` to the OM observation config.
- `packages/memory/src/processors/observational-memory/observer-runner.ts:134-145` resolves `observeAttachments === 'auto'` through `modelSupportsAttachments(routerId)`, defaulting to forwarding attachments only when capability cannot be determined.
- `/om` updates go through `harness.setState()` plus `harness.setThreadSetting()` (`mastracode/src/tui/commands/om.ts:124-133`), so the v1 session and thread metadata receive the changes.
- Startup/thread-switch restoration is host-owned via `attachOMThreadStatePersistence()` / `restoreOMThreadStateForCurrentThread()` (`mastracode/src/agents/thread-caveman-state.ts:38-98`), not a core v1 concern.

### Compatibility notes

No adapter mismatch was found for active turns: v1 request-context state is sufficient for `getDynamicMemory()` and observer model functions to see the current OM settings.

Caveat: `MastraCodeHarnessRuntime.buildThreadMetadata()` includes `cavemanObservations` but not `observeAttachments` in its built-in thread metadata snapshot (`mastracode/src/harness/runtime.ts:1650-1672`). The separate OM thread-state persistence helper is intended to seed/restore `observeAttachments`, and its focused tests pass, but there is no end-to-end v1 runtime test proving new-thread `thread_created` event ordering always seeds `observeAttachments` metadata. This is a coverage gap rather than a confirmed regression, because explicit `/om` changes call `setThreadSetting()` directly and global settings still seed initial state on startup.

The broader live-smoke Finding A (`projectPath` missing from dynamic workspace state) can also prevent a first turn from reaching OM, but that is not specific to these OM toggles.

### Evidence/tests run

Passing focused tests:

```bash
pnpm --filter ./mastracode exec vitest run src/agents/thread-caveman-state.test.ts src/tui/commands/__tests__/om.test.ts src/tui/components/__tests__/om-settings.test.ts src/__tests__/index.test.ts src/harness/runtime.test.ts --bail 1 --reporter=dot
# 5 files passed, 60 tests passed

pnpm --filter @mastra/memory exec vitest run src/index.test.ts src/processors/observational-memory/__tests__/observational-memory.test.ts --bail 1 --reporter=dot
# 2 files passed, 530 tests passed, 1 todo

pnpm --filter @mastra/core exec vitest run src/llm/model/provider-registry.test.ts --bail 1 --reporter=dot
# 1 file passed, 27 tests passed, no type errors

pnpm --filter ./mastracode check
# passed

pnpm --filter ./packages/memory check
# passed
```

### Follow-up

Add a focused `MastraCodeHarnessRuntime` test that creates/switches threads with `observeAttachments` set and verifies the intended thread metadata is persisted/restored through the real v1 runtime event path. No immediate OM-toggle-specific fix is required unless that test exposes ordering loss.

---

## Checkpoint 7 — PR #16548: `feat(mastracode): add Codex device login and MCP OAuth config`

**Verdict:** works with caveat; no new Harness v1 runtime blocker found.

### Original feature behavior

PR #16548 adds two mostly host-side features:

- OpenAI Codex OAuth login supports browser callback mode and device-code mode.
- MCP config loading supports project/global/Claude-compatible files, HTTP MCP servers, and per-server OAuth settings with file-backed token storage.

### Harness v1 runtime path traced

Codex auth/model use is compatible with v1 because the runtime only needs current model state and auth status:

- `/login` runs through `AuthStorage.login()` and then calls `harness.switchModel()` for the provider default model (`mastracode/src/tui/commands/login.ts:37-57`).
- `createMastraCode()` wires the v1 runtime `modelAuthStatusResolver` through `modelAuthChecker`, which maps provider `openai` to stored `openai-codex` OAuth/API-key credentials (`mastracode/src/index.ts:559-586`, `mastracode/src/harness/runtime.ts:296-304`).
- `getDynamicModel()` reads the v1 request-context model/state and `resolveModel()` routes `openai/*` through Codex OAuth when `authStorage.get('openai-codex')` is OAuth (`mastracode/src/agents/model.ts:286-303`, `:313-324`).
- The OAuth provider itself is independent of Harness runtime state (`mastracode/src/auth/providers/openai-codex.ts:532-721`).

MCP server config/tool exposure remains host-owned rather than v1-native:

- `createMastraCode()` creates `mcpManager` separately and injects its currently connected tools into `Agent.tools` through `createDynamicTools()` (`mastracode/src/index.ts:351-367`, `mastracode/src/agents/tools.ts:83-86`).
- TUI `/mcp` uses `ctx.mcpManager` directly for status/reload/reconnect/logs (`mastracode/src/tui/commands/mcp.ts:6-151`).
- TUI starts MCP initialization after the UI owns the terminal (`mastracode/src/tui/mastra-tui.ts:563-577`); headless starts it in the background before running (`mastracode/src/headless.ts:655-676`).

### Compatibility notes

No v1 adapter mismatch was found for Codex auth or MCP tool execution. The important state boundary is model selection/auth, and v1 exposes that correctly through `currentModelId`, `modelAuthStatusResolver`, and request-context state.

Caveat: `MastraCodeHarnessRuntime.mcp` delegates to v1's native MCP catalog (`session.mcp.*`), which lists MCP servers registered on the underlying `Mastra` instance. MastraCode's configured MCP servers are managed by `mcpManager` and injected as tools, not registered as `MCPServerBase` instances on `Mastra`. This is not currently a product regression because `/mcp` and tool exposure use `mcpManager` directly, but any future UI/API that uses `harness.mcp.listServers()` would see an empty native v1 MCP catalog for these configured servers.

Also note the first validation run failed only because local OpenAI auth environment leaked into tests that expect no auth; rerunning with auth env vars unset passed.

### Evidence/tests run

Passing focused tests:

```bash
env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u MASTRA_GATEWAY_API_KEY pnpm --filter ./mastracode test src/providers/__tests__/openai-codex-fetch.test.ts src/mcp/__tests__/config.test.ts src/mcp/__tests__/manager.test.ts src/__tests__/codex-model-routing.test.ts src/agents/__tests__/model.test.ts -- --bail 1 --reporter=dot
# 5 files passed, 110 tests passed

env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u MASTRA_GATEWAY_API_KEY pnpm --filter ./mastracode test src/auth/providers/openai-codex.test.ts -- --bail 1 --reporter=dot
# 1 file passed, 19 tests passed

env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u MASTRA_GATEWAY_API_KEY pnpm --filter ./mastracode test src/harness/runtime.test.ts -- --bail 1 --reporter=dot
# 1 file passed, 30 tests passed

pnpm --filter ./mastracode check
# passed
```

### Follow-up

If consumers start relying on the public `harness.mcp` namespace, either register MastraCode MCP configs with the v1/native Mastra MCP server catalog or adapt `MastraCodeHarnessRuntime.mcp` to delegate to `mcpManager`. No immediate fix is required for current `/mcp` and agent-tool behavior.

---

## Checkpoint 8 — PR #16129: `feat(mastracode): add GitHub Copilot OAuth provider with live model discovery`

**Verdict:** works with caveat; no new Harness v1 runtime blocker found.

### Original feature behavior

PR #16129 adds GitHub Copilot as an OAuth-backed model provider:

- Device-code login for GitHub/GitHub Enterprise, storing the long-lived GitHub OAuth token plus short-lived Copilot bearer token in `AuthStorage`.
- A `github-copilot/*` model route that uses an OpenAI-compatible adapter with Copilot-specific auth/headers.
- Live Copilot model discovery from `/models`, cached for 10 minutes with a conservative `gpt-4.1` fallback on fetch failure.
- GitHub Copilot onboarding/model-pack defaults.

### Harness v1 runtime path traced

OAuth login is compatible with v1 because it stays outside the session turn loop:

- `/login` calls `AuthStorage.login('github-copilot', ...)`, then switches to `PROVIDER_DEFAULT_MODELS['github-copilot']` through `harness.switchModel()` (`mastracode/src/tui/commands/login.ts:37-57`, `mastracode/src/auth/storage.ts:24-31`).
- `MastraCodeHarnessRuntime.switchModel()` updates local `currentModelId`, calls `session.models.switch({ model })`, persists the mode-specific thread setting, and tracks model usage (`mastracode/src/harness/runtime.ts:847-867`).
- v1 `Session.models.switch()` is free-form and only validates model-id shape, so `github-copilot/gpt-4.1` works like other dynamic/custom provider ids (`packages/core/src/harness/v1/session.ts:5628-5636`).

Live model discovery is exposed through MastraCode's runtime wrapper, not v1's static catalog:

- `createMastraCode()` injects `customModelCatalogProvider`, which appends `github-copilot/${id}` entries from `getCopilotModelCatalog({ authStorage })` (`mastracode/src/index.ts:597-631`).
- `MastraCodeHarnessRuntime.listAvailableModels()` merges registry models with this custom provider output and marks auth via `modelAuthChecker` (`mastracode/src/harness/runtime.ts:869-899`).
- `getCurrentModelAuthStatus()` and the v1 `modelAuthStatusResolver` both use that same wrapper path (`mastracode/src/harness/runtime.ts:901-908`, `:1821-1825`).

Turn execution is compatible with v1 request context:

- v1 builds request context with `modelId` and state before each turn.
- `getDynamicModel()` reads `harnessContext.modelId ?? state.currentModelId`, then routes `github-copilot/*` to `githubCopilotProvider()` (`mastracode/src/agents/model.ts:313-324`, `:245-253`).
- `githubCopilotProvider()` sends through `buildGitHubCopilotOAuthFetch()`, which reloads `AuthStorage`, refreshes the bearer token if needed, injects Copilot headers, and marks tool-result follow-ups as `x-initiator: agent` (`mastracode/src/providers/github-copilot.ts:116-197`, `:277-296`).

### Compatibility notes

No runtime behavior regression was found for current MastraCode surfaces: `/login`, `/models`, model packs, model switching, auth status display, and agent/subagent model resolution all use the wrapper/runtime paths that know about dynamic Copilot models.

Caveat: the underlying `HarnessV1` instance is constructed with `models: []` (`mastracode/src/harness/runtime.ts:296-304`). That means native v1 `harness.models.list()` is empty, and v1 `session.models.currentAuthStatus()` returns `'unknown'` for free-form/dynamic models because the model is not in the static v1 catalog (`packages/core/src/harness/v1/session.ts:5619-5625`). Current MastraCode UI uses `MastraCodeHarnessRuntime.listAvailableModels()` and `getCurrentModelAuthStatus()` instead, so this is not a current product blocker. It is a future-consumer caveat if anything starts using native v1 model catalog APIs directly.

Also, the first validation attempt hit the local pnpm/devEngines version guard; rerunning with `--pm-on-fail=ignore` used the repo tests successfully.

### Evidence/tests run

Passing focused tests:

```bash
env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u MASTRA_GATEWAY_API_KEY pnpm --pm-on-fail=ignore --filter ./mastracode test src/auth/providers/__tests__/github-copilot.test.ts src/providers/__tests__/github-copilot-catalog.test.ts src/providers/__tests__/oauth-fetches.test.ts src/agents/__tests__/model.test.ts src/__tests__/index.test.ts src/index.test.ts src/harness/runtime.test.ts -- --bail 1 --reporter=dot
# 7 files passed, 125 tests passed

pnpm --pm-on-fail=ignore --filter ./mastracode check
# passed
```

### Follow-up

If MastraCode wants native Harness v1 model APIs to reflect dynamic/custom providers, add an adapter or dynamic catalog bridge instead of constructing `HarnessV1` with `models: []`. No immediate fix is required for current MastraCode UI/headless behavior.

---

## Checkpoint 9 — PR #13891: `feat(mastracode): allow overriding memory instance via config`

**Verdict:** needs fix for custom mode agents. Default MastraCode modes likely work.

### Original feature behavior

PR #13891 added `memory?: HarnessConfig['memory']` to `MastraCodeConfig`, allowing callers of `createMastraCode({ memory })` to replace the default `getDynamicMemory(storage, vectorStore)` instance/factory.

The legacy Harness treated this as a harness-level runtime service. During init and current-agent lookup, it propagated `this.config.memory` into every static mode agent that did not already own memory:

- `packages/core/src/harness/harness.ts:420-425` iterates configured modes during init.
- `packages/core/src/harness/harness.ts:629-636` calls `agent.__setMemory(this.config.memory)` when `!agent.hasOwnMemory()`.
- `packages/core/src/harness/harness.ts:657-660` also propagates services when resolving the current agent.

That means a custom `config.modes` entry with its own `Agent` still inherited the configured memory override unless it explicitly configured its own memory.

### Harness v1 runtime path traced

The current v1 branch keeps the default mode path working:

- `mastracode/src/index.ts:349` selects `const memory = config?.memory ?? getDynamicMemory(storage, vectorStore)`.
- `mastracode/src/index.ts:514-516` injects that memory into the default `codeAgent` when it does not already own memory.
- `mastracode/src/index.ts:638-642` passes the same memory to `MastraCodeHarnessRuntime` and to generated v1 subagent agents.
- `mastracode/src/harness/subagents.ts:29-33` injects memory into generated subagent agents.
- `packages/core/src/harness/v1/session.ts:3886-3890` passes `{ thread, resource }` memory execution options to the active agent, so an agent with injected memory will use the configured override.
- `mastracode/src/harness/runtime.ts:1483-1504` also exposes `getResolvedMemory()` using the configured memory and a MastraCode-shaped request context for TUI goal-judge code.

### Issue found

The v1 adapter does **not** reproduce legacy harness-level memory propagation for arbitrary custom mode agents.

`MastraCodeHarnessRuntime` builds the v1 agent map from all configured agents:

- `mastracode/src/harness/runtime.ts:291` calls `toHarnessV1Agents(config.agents, config.modes)`.
- `mastracode/src/harness/runtime.ts:296-310` constructs `HarnessV1` with those agents/modes.
- `mastracode/src/harness/config.ts:98-113` maps each static `mode.agent` to its v1 `agentId`.

But the only memory injection before that is the default `codeAgent` injection in `mastracode/src/index.ts:514-516` and generated subagent injection in `mastracode/src/harness/subagents.ts:31-33`. There is no v1 equivalent of legacy `propagateRuntimeServicesToAgent()` for every custom static `mode.agent`.

Result: `createMastraCode({ memory, modes: [{ agent: customAgent, ... }] })` can route turns to `customAgent` without that memory override unless the caller manually configured memory on the custom agent. Legacy Harness would have injected the override.

### Evidence/tests run

Passing focused tests for existing default-path behavior:

```bash
env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u MASTRA_GATEWAY_API_KEY pnpm --pm-on-fail=ignore --filter ./mastracode test src/__tests__/index.test.ts src/index.test.ts src/harness/runtime.test.ts -- --bail 1 --reporter=dot
# 3 files passed, 44 tests passed

pnpm --pm-on-fail=ignore --filter ./mastracode check
# passed
```

Coverage gap: there is no focused test asserting that `config.memory` is propagated to custom mode agents under the v1 runtime. The compatibility issue is trace-proven by comparing legacy `propagateRuntimeServicesToAgent()` with the current v1 adapter injection sites above.

### Recommended fix

Add a small v1-runtime service propagation step that mirrors legacy behavior for all static mode agents before sessions can execute them:

- Iterate the agents returned by `toHarnessV1Agents()` or the configured static `mode.agent` instances.
- If `config.memory` is present and `!agent.hasOwnMemory()`, call `agent.__setMemory(config.memory)`.
- Add a focused MastraCode runtime/index test with a custom mode agent and `createMastraCode({ memory, modes })`, asserting the custom agent receives the memory override.

Default MastraCode modes and generated subagents do not appear blocked; this is an API compatibility regression for custom mode-agent users.

---

## Checkpoint 10 — PR #16094: `feat(mastracode): add /tmp as default allowed workspace path`

**Verdict:** feature logic is correct, but it is currently blocked in v1 by the shared-workspace `RequestContext` regression already captured as Live smoke Finding A.

### Original feature behavior

PR #16094 adds OS temp paths as default allowed workspace paths so MastraCode can use temp/scratch files without prompting for sandbox access:

- `mastracode/src/agents/workspace.ts:72-76` builds `DEFAULT_ALLOWED_PATHS` from `os.tmpdir()` and `/tmp`, deduped after `path.resolve()`.
- `mastracode/src/agents/workspace.ts:106-110` merges those defaults with `allowedSkillPaths` and per-thread `sandboxAllowedPaths`.
- `mastracode/src/agents/workspace.ts:128-130` updates allowed paths on an existing reused workspace via `existing.filesystem.setAllowedPaths(allowedPaths)`.
- `mastracode/src/agents/workspace.ts:146-149` passes the same `allowedPaths` into the first `LocalFilesystem` instance.

### Harness v1 runtime path traced

The temp-path feature itself is runtime-agnostic because it lives in `getDynamicWorkspace()`.

The v1 adapter wires that function into Harness v1 as a **shared workspace**:

- `mastracode/src/index.ts:653` passes `workspace: config?.workspace ?? getDynamicWorkspace`.
- `mastracode/src/harness/runtime.ts:304-308` constructs `HarnessV1` with `workspace: { kind: 'shared', workspace: ({ requestContext }) => config.workspace!({ requestContext, mastra: this.mastra }) }`.
- `packages/core/src/harness/v1/workspace/registry.ts:177-185` resolves a shared workspace by creating `new RequestContext()` and calling the workspace factory with that empty context.

That means MastraCode's `getDynamicWorkspace()` does not receive the v1 harness slot when the shared workspace is first acquired. It reads:

- `mastracode/src/agents/workspace.ts:94-101`: `requestContext.get('harness')`, then `ctx?.getState()`, then throws `Error('Project path is required')` if `state.projectPath` is missing.

So PR #16094 cannot be observed reliably under the current v1 default path: workspace creation can fail before the `/tmp` allowed-path list is applied. This is the same root cause as Live smoke Finding A, now narrowed further: shared workspace acquisition invokes the provider with an empty `RequestContext`, not the session request context carrying `state.projectPath`.

### Evidence/tests run

Passing focused tests:

```bash
pnpm --filter ./mastracode test src/agents/__tests__/workspace-skill-paths.test.ts --run --bail 1 --reporter=dot
# 1 file passed, 4 tests passed

pnpm --filter ./mastracode test src/harness/runtime.test.ts --run --bail 1 --reporter=dot
# 1 file passed, 30 tests passed

pnpm --filter ./packages/core test src/harness/v1/workspace/registry.test.ts src/harness/v1/workspace-runtime.test.ts src/harness/v1/workspace-session.test.ts src/harness/v1/session.workspace-policy.test.ts -- --run --bail 1 --reporter=dot
# 4 files passed, 54 tests passed, no type errors

pnpm --filter ./mastracode exec tsc --noEmit
# passed
```

Coverage gap: existing tests cover direct workspace path wiring and generic v1 workspace lifecycle, but they do not cover MastraCode's shared workspace factory receiving a session-populated harness `RequestContext`.

### Recommended fix

Fix the shared-workspace RequestContext path before judging PR #16094 as fully working in the v1 TUI:

- Either configure MastraCode's workspace as `per-resource`/`per-session` so the provider receives a session/resource context with state, or teach v1 shared workspace acquisition to receive enough owner/session state for MastraCode's dynamic provider.
- Add a focused MastraCode v1 runtime test that starts with `initialState.projectPath`, resolves the default workspace through the v1 runtime/session path, and asserts the resulting filesystem allowed paths include both the project root behavior and resolved temp path(s).

Once that shared-workspace context bug is fixed, the `/tmp` feature itself should work; no separate PR #16094 logic bug was found.

---

## Checkpoint 11 — PRs #16006 / #14962 / #14909: headless stdin, thread control, and model CLI options

**Verdict:** likely works with caveat — no new headless-specific Harness v1 blocker found, but default headless turns are still blocked by Live smoke Finding A until the shared-workspace `RequestContext` path is fixed.

### Original feature behavior

This checkpoint covers the headless/CLI cluster that is reachable from `HEAD`:

- #16006 adds piped stdin support for the interactive TUI path. `mastracode/src/utils/stdin-pipe.ts` drains piped stdin with a 1 MiB cap, sanitizes terminal output, reopens stdin from `/dev/tty` when possible, and passes the drained content as the TUI `initialMessage`.
- #14962 adds headless thread controls: `--continue`, `--thread`, `--clone-thread`, `--resource-id`, and `--title`.
- #14909 adds headless model/mode controls: `--model`, `--mode`, `--thinking-level`, and `--settings`.

### Harness v1 runtime path traced

The headless implementation uses the MastraCode wrapper API, not private v1 session internals, except where it intentionally auto-resolves v1 pending items:

- `mastracode/src/headless.ts:473-551` subscribes to harness events, selects/creates/clones/renames threads, sends the prompt, and waits for `agent_end` / `error` / timeout.
- `mastracode/src/headless.ts:208-255` auto-resolves `sandbox_access_request`, `tool_approval_required`, `tool_suspended`, `ask_question`, and `plan_approval_required`. For v1-specific sandbox/tool suspension paths it casts to the adapter surface (`respondToSandboxAccess`, `respondToToolSuspension`), which `MastraCodeHarnessRuntime` implements at `mastracode/src/harness/runtime.ts:1403-1451`.
- `mastracode/src/harness/runtime.ts:603-725` implements the v1-backed thread paths used by `--thread`, `--continue`, `--clone-thread`, `--title`, and `--resource-id`.
- `mastracode/src/harness/runtime.ts:814-867` implements the v1-backed mode/model switching used by `--mode` and `--model` through `session.switchMode()`, `session.models.switch()`, and per-thread model settings.
- `mastracode/src/harness/runtime.ts:866-893` supports lazy session creation after `setResourceId()` before a headless send, so `--resource-id` before thread selection is compatible with v1.

The main caveat is not specific to these PRs: once headless sends a message, the default v1 workspace still resolves through the same shared-workspace path from Finding A. `session.message()` builds a request context and resolves workspace/toolsets; if the shared workspace was acquired with an empty `RequestContext`, `getDynamicWorkspace()` can still throw `Project path is required` before the turn proceeds.

### Evidence/tests run

Passing focused tests:

```bash
pnpm --filter ./mastracode exec vitest run src/headless.test.ts src/headless-integration.test.ts src/harness/runtime.test.ts --bail 1 --reporter=dot --typecheck.enabled false
# 3 files passed, 98 tests passed

pnpm --filter ./mastracode exec vitest run src/utils/__tests__/stdin-pipe.test.ts --bail 1 --reporter=dot --typecheck.enabled false
# 1 file passed, 21 tests passed

pnpm --filter ./mastracode check
# passed
```

Coverage note: `headless-integration.test.ts` still uses the legacy `Harness` test helper, so it validates the headless feature behavior but not the v1 adapter end-to-end. The relevant v1 wrapper APIs are covered indirectly by `mastracode/src/harness/runtime.test.ts` (thread metadata restore, cross-resource listing, lazy session creation after resource-id changes, no-op same-resource changes, signal routing, model/mode helpers).

### Recommended follow-up

No headless-specific fix is needed from this checkpoint. After Finding A is fixed, add one narrow v1-backed headless smoke test for the real `createMastraCode()` path:

- initialize via `initCore()` rather than legacy `init()`;
- set a custom `--resource-id` or `--thread`;
- send a trivial prompt;
- assert the run reaches `agent_end` without `Project path is required` and emits a thread id in `json` / `stream-json` output.

---

## Live smoke findings — PR #16943 local TUI run

Reported while loading the current Harness v1 runtime branch and sending a first message (`hi`). These are direct runtime regressions separate from the historical feature-PR checkpoints above.

### Finding A — first message fails with `Error: Project path is required`

**Verdict:** needs fix.

#### Symptom

TUI created a new thread, then immediately rendered:

```text
Error: Project path is required
```

#### Throw site traced

The error is thrown by MastraCode's dynamic workspace factory:

- `mastracode/src/agents/workspace.ts:94-101`

```ts
const ctx = requestContext.get('harness') as HarnessRequestContext<MastraCodeState> | undefined;
const state = ctx?.getState();
const rawProjectPath = state?.projectPath;

if (!rawProjectPath) {
  throw new Error('Project path is required');
}
```

#### Harness v1 runtime path involved

- `mastracode/src/harness/runtime.ts:342-345` initializes core, then selects/creates a thread.
- `mastracode/src/harness/runtime.ts:603-631` selects/creates the thread, binds a v1 session, calls `ensureSessionState()`, syncs controls, then tries `resolveWorkspace().catch(() => undefined)`.
- `mastracode/src/harness/runtime.ts:1776-1782` persists `this.state` into the v1 session via `session.setState(this.state)`.
- The crash means that, when `getDynamicWorkspace()` is called from the agent/workspace path, `ctx.getState()` does not include a truthy `projectPath`.

#### Why this matters

`projectPath` is required for all MastraCode workspace tools and was always part of the legacy harness state. A first-message failure means either:

1. the v1 session state is being initialized without `projectPath` in this startup path, or
2. the request context used by dynamic workspace resolution is not reading the session state that `ensureSessionState()` persisted, or
3. a workspace resolution path is running before the session state is initialized.

#### Recommended validation/fix

Add a focused runtime test that creates `MastraCodeHarnessRuntime` with `initialState.projectPath`, initializes it, and then exercises the same workspace resolution path used by the first message. Assert `getDynamicWorkspace()` sees `state.projectPath` from the v1 `RequestContext`.

Likely fix area:

- Ensure `MastraCodeHarnessRuntime.ensureSessionState()` always persists `projectPath` before any workspace/toolset construction.
- Ensure v1 `_buildRequestContext()` / session state plumbing returns the latest session state to dynamic workspace providers.

### Finding B — restart can fail with `HarnessSessionLockedError`

**Verdict:** needs UX/runtime hardening.

#### Symptom

A later run showed:

```text
Fatal error: Session "sess-b6f5d4b5-d0dc-4d8d-b4e9-13b4bfe4f847" is locked by owner "harness-2e30a1e0-25d1-44e2-bc3a-26bb761e9413" until 2026-05-25T19:34:55.567Z
HarnessSessionLockedError: Session "sess-b6f5d4b5-d0dc-4d8d-b4e9-13b4bfe4f847" is locked ...
    at Harness._acquireLease (.../packages/core/src/harness/v1/harness.ts:2483:15)
    at async Harness._hydrate (.../packages/core/src/harness/v1/harness.ts:2245:19)
    at async MastraCodeHarnessRuntime.selectOrCreateThread (.../mastracode/src/harness/runtime.ts:622:7)
    at async MastraCodeHarnessRuntime.init (.../mastracode/src/harness/runtime.ts:344:5)
```

#### Throw site traced

- `packages/core/src/harness/v1/harness.ts:2244-2252` hydrates a stored session by acquiring a lease.
- `packages/core/src/harness/v1/harness.ts:2474-2484` maps a storage lease conflict to `HarnessSessionLockedError`.
- `mastracode/src/harness/runtime.ts:603-628` auto-selects an existing thread/session at startup, so a stale live lease blocks TUI initialization.

#### Why this matters

For local MastraCode, a crashed/aborted previous process can leave a lease valid for its TTL. The next TUI launch should not fatal on startup for a normal local restart path. It should either recover gracefully, wait/retry with a friendly message, select/create a fresh session for the thread, or provide a clear recovery path.

The screenshot also shows a non-fatal observability warning:

```text
User-specified tracing strategy not supported by storage adapter, falling back to auto-selection
```

That warning is secondary/noisy, but the fatal lease error is the compatibility blocker.

#### Recommended validation/fix

Add a focused runtime/startup test that simulates an existing thread whose v1 session has an unexpired foreign owner lease, then calls `MastraCodeHarnessRuntime.init()` / `selectOrCreateThread()`.

Expected behavior should be decided, but it should not be an opaque fatal crash. Reasonable options:

- wait/retry until lease expiry with a clear status message,
- create/adopt a new session for the selected thread if safe,
- or surface a friendly actionable error with recovery guidance.

---

## Checkpoint 12 — PR #15036: `feat(mastracode): add browser automation support`

**Verdict:** works with caveat; no new Harness v1 runtime blocker found.

Note: follow-up #15285 (`fix(agent-browser): initialize browser for default thread ID in thread scope`, commit `00d10eb096`) appeared in all-ref search, but is **not reachable from current `HEAD`**, so it is excluded under the corrected audit scope. This checkpoint audits the HEAD-reachable browser automation PR #15036.

### Original feature behavior

PR #15036 adds browser automation wiring for MastraCode:

- `/browser` TUI command can enable/disable browser automation, configure provider/launch options, and persist settings.
- Startup can lazily create a browser from persisted settings and attach it to the harness.
- Agents receive an SDK browser (`StagehandBrowser` or `AgentBrowser`) so browser tools are included during agent execution.
- Active browser config is tracked in harness state as `activeBrowserSettings` for status/config-drift reporting.

### Harness v1 runtime path traced

The current v1 adapter keeps the feature on MastraCode's wrapper/runtime layer rather than depending on v1-native `Harness.setBrowser()`:

- `mastracode/src/main.ts:111-117` lazily creates a browser from settings, calls `harness.setBrowser(browser)`, then stores `activeBrowserSettings` in state.
- `mastracode/src/tui/commands/browser.ts:85-97` applies live `/browser` changes by iterating `ctx.harness.listModes()`, calling `agent.setBrowser(browser)`, and updating `activeBrowserSettings`.
- `mastracode/src/harness/runtime.ts:1519-1528` implements wrapper-level `setBrowser()` by propagating to static mode agents and configured agents.
- `mastracode/src/harness/runtime.ts:296-310` constructs `HarnessV1` without passing the browser into v1 core; this is okay for current MastraCode because browser tools live on the Agent instances that the v1 harness runs.
- `packages/core/src/agent/agent.ts:833-845` stores the browser on the Agent; `packages/core/src/agent/agent.ts:3260-3299` adds browser provider tools during tool conversion.
- `packages/core/src/harness/v1/session.ts:3866-3896` dispatches turns through the same Agent execution path, with thread/resource memory context, so browser tools execute through normal Agent tool plumbing.

### Caveat

MastraCode and v1 core now have two browser propagation surfaces:

- MastraCode wrapper: `MastraCodeHarnessRuntime.setBrowser()` / `/browser` command directly mutate mode Agent instances.
- v1 core: `HarnessV1.setBrowser()` exists separately, but MastraCode does not delegate to it.

That is not a current product blocker because all current MastraCode browser entry points use the wrapper/mode-agent path and browser tools are resolved from the Agent. Future consumers that expect the underlying v1 `Harness` browser surface to reflect MastraCode's browser state may see divergence.

Also, `MastraCodeHarnessRuntime.setBrowser()` skips agents where `hasOwnBrowser()` is true, and `Agent.setBrowser()` marks the browser explicit. Current live `/browser` reconfiguration bypasses this guard via `applyBrowserToAgents()`, so the user-facing command can still update/disable the browser, but direct repeated calls to wrapper `setBrowser()` may not update already-managed agents.

### Evidence/tests run

Passing focused validation:

```bash
pnpm --filter mastracode --config.manage-package-manager-versions=false test src/harness/runtime.test.ts src/onboarding/__tests__/settings.test.ts -- --bail 1 --reporter=dot
# 2 files, 51 tests passed

pnpm --filter ./browser/agent-browser --config.manage-package-manager-versions=false test src/__tests__/thread-manager.test.ts -- --bail 1 --reporter=dot
# 1 file, 18 tests passed

pnpm --filter ./packages/core --config.manage-package-manager-versions=false test:unit src/browser/browser.test.ts src/browser/processor.test.ts src/browser/screencast/screencast-stream.test.ts -- --bail 1 --reporter=dot
# 3 files, 41 tests passed; no type errors

pnpm --filter mastracode --config.manage-package-manager-versions=false check
# tsc --noEmit passed

pnpm --filter ./packages/core --config.manage-package-manager-versions=false check
# tsc --noEmit passed

pnpm --filter ./browser/agent-browser --config.manage-package-manager-versions=false build
# tsup build passed
```

Validation note: `packages/core/src/browser/__tests__/thread-manager.test.ts` does not exist on this branch, consistent with #15285 being outside the HEAD-reachable audit scope.

### Recommended follow-up

No blocking fix required for #15036 compatibility with the current v1 adapter.

Optional hardening:

- Decide whether `MastraCodeHarnessRuntime.setBrowser()` should also call v1 `this.core.setBrowser()` so wrapper/core browser state cannot diverge.
- Consider tracking whether browser ownership came from the runtime wrapper separately from Agent-level explicit browser ownership, so direct repeated `harness.setBrowser(nextBrowser)` reliably updates runtime-managed agents.

---

## Checkpoint 13 — PR #14845: `feat(mastracode): allow custom response on questions with options`

**Verdict:** works with caveat; no new Harness v1 runtime blocker found.

### Original feature behavior

PR #14845 adds a free-text escape hatch to option-based question prompts:

- `AskQuestionDialogComponent` and `AskQuestionInlineComponent` append a `✎ Custom response...` option when a prompt has selectable options.
- Selecting that synthetic option switches the prompt from `SelectList` mode to free-text input mode instead of submitting one of the provided labels.
- Submitting the free-text answer calls the same `onSubmit(answer)` callback as any selected option.
- Current code keeps `allowCustomResponse` defaulted to `true`, with an opt-out flag available on both dialog and inline component options.

This is primarily TUI behavior. The harness-facing answer value remains a plain string.

### Harness v1 runtime path traced

The current v1 path preserves the same answer shape and resume semantics:

- v1 `askUser` suspends through `ctx.agent.suspend()` and registers question metadata before suspension when a harness request context is present (`packages/core/src/harness/v1/builtin-tools/ask-user.ts:50-73`).
- v1 session capture classifies `ask_user` suspensions as `question`, records `question`, `options`, and `selectionMode` in `pendingResume.payload`, and emits `suspension_required` after the pending resume is durable (`packages/core/src/harness/v1/session.ts:5459-5511`, `packages/core/src/harness/v1/session.ts:5530-5540`).
- MastraCode's projector converts that pending item into the legacy `ask_question` event shape with `questionId`, `question`, and `options` (`mastracode/src/harness/events.ts:157-164`).
- The TUI dispatcher calls `handleAskQuestion()`, which activates the inline/dialog component and, on submit, calls `state.harness.respondToQuestion({ questionId, answer })` (`mastracode/src/tui/event-dispatch.ts:365-367`, `mastracode/src/tui/handlers/prompts.ts:48-164`).
- `MastraCodeHarnessRuntime.respondToQuestion()` maps the legacy `questionId` back to v1 `itemId` and delegates to `Session.respondToQuestion()` (`mastracode/src/harness/runtime.ts:1370-1374`).
- v1 `Session.respondToQuestion()` resumes with `{ answer }` (`packages/core/src/harness/v1/session.ts:6402-6410`), which matches the built-in `askUser` resume schema.

Because the custom-response branch only changes the TUI component from option selection to free-text input, it does not require new v1 state, storage, event, or resume plumbing.

### Caveat

The v1 event projection currently drops `selectionMode` when projecting `suspension_required(kind: 'question')` to MastraCode's legacy `ask_question` event (`mastracode/src/harness/events.ts:157-164`). That is not a regression introduced by #14845 — the custom response feature only submits a string answer — but it means multi-select `ask_user` prompts are still not represented in the MastraCode TUI path.

Also, `AskQuestionInlineComponent` defaults `allowCustomResponse` to `true` for all option prompts. That includes `sandbox_access_request` prompts because they reuse the same component; free-form non-yes answers are treated as denial by existing approval parsing. This matches the current component behavior and is not v1-specific, but the UX may be worth tightening later by passing `allowCustomResponse: false` for strict approve/deny prompts.

### Evidence/tests run

Passing focused validation:

```bash
env -u OPENAI_API_KEY -u OPENAI_API_KEY_B64 pnpm --pm-on-fail=ignore --filter ./mastracode exec vitest run src/tui/components/__tests__/ask-question-inline-multiline.test.ts src/tui/handlers/__tests__/prompts.test.ts src/tui/__tests__/parallel-interactive-prompts.test.ts src/harness/events.test.ts --bail 1 --reporter=dot
# 4 files, 27 tests passed

env -u OPENAI_API_KEY -u OPENAI_API_KEY_B64 pnpm --pm-on-fail=ignore --filter ./mastracode check
# tsc --noEmit passed

pnpm --pm-on-fail=ignore --filter ./packages/core exec vitest run src/harness/v1/builtin-tools/__tests__/ask-user.test.ts --bail 1 --reporter=dot --typecheck.enabled=false
# 1 file, 5 tests passed

pnpm --pm-on-fail=ignore --filter ./packages/core exec vitest run src/harness/v1/session.suspend.test.ts --testNamePattern='classifies as "question"|keeps a question registered|respondToQuestion' --bail 1 --reporter=dot --typecheck.enabled=false --pool=forks
# 1 file, 16 passed, 36 skipped
```

Validation notes:

- A first incorrectly scoped MastraCode test command ran the broad suite and hit unrelated local OpenAI auth environment failures; the targeted rerun above unset OpenAI env vars and passed.
- A full `session.suspend.test.ts` run printed the expected question-related dots but did not exit before the 120s command timeout, so the focused test-name-pattern run with forks is the counted v1 validation.

### Recommended follow-up

No blocking fix required for #14845 compatibility with the current v1 adapter.

Optional hardening:

- Preserve `selectionMode` in `MastraCodeHarnessEventProjector`'s `ask_question` event and add UI coverage if MastraCode intends to support multi-select ask_user prompts.
- Pass `allowCustomResponse: false` for strict approve/deny prompts such as sandbox access if the extra custom option is considered confusing.

---

## Checkpoint 14 — PR #14377: `feat(mastracode): improve MCP server management with interactive /mcp selector`

**Verdict:** works with caveat; no new Harness v1 runtime blocker found.

### Original feature behavior

PR #14377 improves MCP server management in the TUI:

- `/mcp` opens an interactive selector overlay showing connected, failed, connecting, and skipped MCP servers.
- The selector supports keyboard navigation, per-server actions (`View tools`, `View logs`, `View error`, `Reconnect`), reload-all via `r`, and polling while servers are still connecting.
- `/mcp reload` remains a text command that reconnects all configured servers.
- `/mcp status` prints a non-interactive status dump.
- When no servers are configured, `/mcp` shows setup instructions and project/global/Claude-compatible config paths.

This feature is TUI/MCP-manager lifecycle behavior. It does not add new v1 session turn semantics.

### Harness v1 runtime path traced

The current v1 runtime path is compatible with the selector's behavior:

- `createMastraCode()` constructs `mcpManager` independently of Harness v1 and injects MCP tools into the dynamic agent tool factory through `createDynamicTools(mcpManager, ...)` (`mastracode/src/index.ts:352`, `mastracode/src/index.ts:367`, `mastracode/src/agents/tools.ts:83-85`).
- TUI startup defers MCP initialization until after `ui.start()` so status messages are rendered through the TUI rather than corrupting the terminal (`mastracode/src/tui/mastra-tui.ts:563-578`).
- Headless mode initializes MCP in the background before sending the prompt and disconnects on cleanup (`mastracode/src/headless.ts:655-658`, `mastracode/src/headless.ts:674-676`).
- `/mcp` uses `ctx.mcpManager` directly for status, reload, reconnect, logs, skipped servers, and config paths (`mastracode/src/tui/commands/mcp.ts:6-94`). The selector only mutates its own component state and calls the manager callbacks (`mastracode/src/tui/components/mcp-selector.ts:258-389`, `mastracode/src/tui/components/mcp-selector.ts:412-540`).
- `McpManager.reload()` and `reconnectServer()` rebuild or reconnect the `MCPClient`, refresh the manager's tool map, refresh server status, and preserve stderr logs/status for the selector (`mastracode/src/mcp/manager.ts:323-331`, `mastracode/src/mcp/manager.ts:334-440`).

No Harness v1 session state, request context, suspension, signal, or event-projection change is required for the interactive selector.

### Caveat

There are now two MCP catalog surfaces:

- MastraCode's product path uses `mcpManager` and dynamic tools.
- `MastraCodeHarnessRuntime.mcp.*` delegates to v1 `session.mcp.*` (`mastracode/src/harness/runtime.ts:277-281`), and v1 `session.mcp.*` lists MCP servers registered on the internal Mastra instance (`packages/core/src/harness/v1/session.ts:2282-2292`, `packages/core/src/harness/v1/harness.ts:1445-1456`).

Current MastraCode `/mcp` and dynamic tool execution use `mcpManager`, so PR #14377 works. However, future consumers of the wrapper's native `harness.mcp.*` surface may still see an empty/different catalog unless MastraCode's manager-backed servers are bridged into v1's native MCP registry or the wrapper methods are redirected to `mcpManager`.

This is the same architectural caveat noted for PR #16548, not a new runtime blocker introduced by the selector.

### Evidence/tests run

Passing focused validation:

```bash
pnpm --pm-on-fail=ignore --filter ./mastracode test src/mcp/__tests__/config.test.ts src/mcp/__tests__/manager.test.ts src/tui/__tests__/command-dispatch.test.ts -- --run --bail 1 --reporter=dot
# 3 files, 85 tests passed

pnpm --pm-on-fail=ignore --filter ./mastracode check
# tsc --noEmit passed
```

### Recommended follow-up

No blocking fix required for #14377 compatibility with the current v1 adapter.

Optional hardening:

- Add focused component tests for `McpSelectorComponent` once a stable pi-tui overlay testing pattern exists (navigation, reconnect, reload, logs, polling cleanup).
- Decide whether `MastraCodeHarnessRuntime.mcp.*` should expose `mcpManager` state so wrapper/native v1 MCP catalogs do not diverge.

---

## Checkpoint 15 — PRs #13999 / #13437: shell passthrough and workspace tool streaming

**Verdict:** needs fix for v1 workspace tool streaming. Shell passthrough itself is TUI-local and works; workspace-backed shell/process streaming does not fully reach MastraCode through Harness v1.

### Original feature behavior

This final PR group moved and improved command/tool streaming:

- #13999 adds shell passthrough streaming for user-entered `!`/shell commands, rendering real-time stdout/stderr in `ShellStreamComponent`.
- #13437 delegates filesystem/search/edit/write/execute/process tools to the Workspace toolset instead of keeping those implementations in `createDynamicTools()`.
- Workspace `execute_command`, `get_process_output`, and `kill_process` emit streaming process chunks through `ctx.writer.custom(...)` so the TUI/headless output can update before final `tool_end`.
- `ToolExecutionComponentEnhanced.appendStreamingOutput()` appends real-time output for shell/process tools, and `event-dispatch.ts` routes `shell_output` events into that component.

### Harness v1 runtime path traced

The non-streaming workspace-tool path is wired correctly:

- `createDynamicTools()` now intentionally leaves workspace-equivalent tools out of the dynamic tools map; only `request_access`, web search/extract, MCP tools, and `extraTools` remain (`mastracode/src/agents/tools.ts:51-121`).
- `getDynamicWorkspace()` creates/reuses the MastraCode workspace and configures tool names/plan-mode write-tool disabling via `Workspace.setToolsConfig()` (`mastracode/src/agents/workspace.ts:94-158`).
- `MastraCodeHarnessRuntime` passes that workspace factory into v1 as a shared workspace, so v1 request contexts can resolve the same Workspace-backed tools once `projectPath` is available.
- The TUI/headless surface expects normalized `shell_output` events: `mastracode/src/tui/event-dispatch.ts:101-102`, `mastracode/src/tui/handlers/tool.ts:276-288`, and `mastracode/src/headless.ts:284-285`.

The streaming bridge is where v1 diverges from the legacy Harness.

### Issue found

Workspace tools emit `data-sandbox-*` chunks, but v1 currently only bridges `data-shell-output` chunks into `shell_output` events.

Evidence:

- Workspace `execute_command` emits:
  - `data-sandbox-stdout` for stdout (`packages/core/src/workspace/tools/execute-command.ts:225-231`)
  - `data-sandbox-stderr` for stderr (`packages/core/src/workspace/tools/execute-command.ts:233-239`)
  - `data-sandbox-exit` on completion/failure (`packages/core/src/workspace/tools/execute-command.ts:243-251`, `packages/core/src/workspace/tools/execute-command.ts:266-274`)
- Workspace `get_process_output(wait: true)` emits the same stdout/stderr/exit chunk family (`packages/core/src/workspace/tools/get-process-output.ts:64-92`).
- Workspace `kill_process` emits `data-sandbox-exit` (`packages/core/src/workspace/tools/kill-process.ts:60-62`).
- Legacy Harness explicitly bridges `data-sandbox-stdout` and `data-sandbox-stderr` to `shell_output` (`packages/core/src/harness/harness.ts:2822-2835`).
- Harness v1 `_drainStreamToEvents()` only recognizes `data-shell-output` for shell streaming and ignores the workspace `data-sandbox-stdout`/`data-sandbox-stderr` chunks (`packages/core/src/harness/v1/session.ts:3718-3735`).

Result: under Harness v1, Workspace tool execution still completes and returns final output at `tool_end`, but the live streaming behavior added by #13437 is lost for workspace-backed `execute_command`, `get_process_output(wait:true)`, and related process tooling. That affects both TUI real-time display and headless `shell_output` streaming.

This is separate from the already-recorded live-smoke Finding A (`projectPath` missing from the shared-workspace request context), which can prevent workspace resolution entirely. Even after Finding A is fixed, the chunk-name mismatch still prevents live process output from streaming through v1.

### Evidence/tests run

Passing focused validation:

```bash
pnpm --pm-on-fail=ignore --filter mastracode test src/tui/components/__tests__/tool-execution-enhanced.test.ts src/harness/runtime.test.ts src/agents/__tests__/workspace-env.test.ts -- --run --bail 1 --reporter=dot
# 3 files, 92 tests passed

pnpm --pm-on-fail=ignore --filter @mastra/core test -- src/workspace/tools/__tests__/sandbox-tools.test.ts src/workspace/tools/__tests__/workspace-tools-metadata.test.ts src/harness/v1/session.display-state.test.ts src/harness/display-state.test.ts --run --bail 1 --reporter=dot
# 4 files, 190 tests passed; type errors: none

pnpm --pm-on-fail=ignore --filter mastracode check
# tsc --noEmit passed

pnpm --pm-on-fail=ignore --filter ./packages/core check
# tsc --noEmit passed
```

Validation gap: existing tests cover the UI component, workspace tools, display-state handling for `shell_output`, and v1 display state, but they do not cover v1 bridging Workspace `data-sandbox-*` stream chunks into `shell_output` events.

### Recommended fix

Update Harness v1 stream draining to normalize the same Workspace sandbox chunks that legacy Harness already supports:

- Bridge `data-sandbox-stdout` to `shell_output` with `stream: 'stdout'`.
- Bridge `data-sandbox-stderr` to `shell_output` with `stream: 'stderr'`.
- Optionally preserve/handle `data-sandbox-exit` for display-state completion metadata if needed, but do not emit duplicate `tool_end`.
- Add a focused v1 test that streams a tool emitting `data-sandbox-stdout`/`data-sandbox-stderr` while the tool is active and asserts subscribers receive `shell_output` before `tool_end`.

Shell passthrough (`mastracode/src/tui/shell.ts` + `ShellStreamComponent`) is TUI-local and does not need v1 changes.

---

## Final audit summary — 2026-05-25

### Scope and discovery

This audit reviewed recent MastraCode feature work reachable from the current `HEAD` of `feat/mastracode-harness-v1-runtime`, not every local/remote ref. The queue was rebuilt after discovering the original `git log --all` candidate set included branch-drift and unrelated feature-branch commits.

Discovery evidence used:

- Git/local history and reachability checks (`git log`, `git merge-base --is-ancestor`, `git branch --contains`).
- Changed-file/path review across `mastracode/**`, Harness v1, workspace tools, TUI/headless, auth/model providers, MCP, browser, memory, and settings.
- Focused source traces through `MastraCodeHarnessRuntime`, Harness v1 `Session`, event projection, TUI handlers, headless mode, Workspace tools, and relevant core helpers.

### Audited PR list and verdicts

| # | PR(s) | Feature surface | Verdict |
|---:|---|---|---|
| 1 | #16231 | Follow-ups through Agent signals | **Needs fix** — persisted v1 user-message signal conversion drops `delivery:'while-active'` attributes and non-text content. |
| 2 | #16065 | `/goal` persistent goal command | **Needs fix** — terminal judge output uses `injectSystemReminder()`, which is also a wake/interleave primitive and may unintentionally wake the agent. |
| 3 | #16676 | Return to plan after approved goal | **Likely works with caveat** — behavior is orthogonal to v1 submit-plan transitions, but inherits Checkpoint 2's system-reminder wake caveat. |
| 4 | #16618 | `/skill/<name>` explicit skill activation | **Likely works with caveat** — skill resolution path works, but is blocked when Finding A (`projectPath` missing) prevents v1 workspace resolution. |
| 5 | #16771 | Quiet mode | **Works** — TUI-only rendering preference; no v1 runtime interaction required. |
| 6 | #16682 / #16275 / #16922 | OM toggles: caveman, observe attachments, auto attachment capability | **Likely works with caveat** — v1 state propagation works; no end-to-end v1 runtime test covers `thread_created` ordering for `observeAttachments`. |
| 7 | #16548 | Codex device login and MCP OAuth config | **Works with caveat** — client-side auth/MCP manager works; wrapper `harness.mcp.*` delegates to v1 native MCP catalog, which does not include MastraCode `mcpManager` servers. |
| 8 | #16129 | GitHub Copilot OAuth + live model discovery | **Works with caveat** — product path uses wrapper model catalog/auth methods; native v1 `models: []` means `session.models.currentAuthStatus()` may return `unknown` for dynamic/free-form models. |
| 9 | #13891 | Custom memory instance override | **Needs fix for custom mode agents** — v1 adapter injects memory into the default code agent and generated subagents, but not arbitrary custom `config.modes[].agent`, unlike legacy service propagation. |
| 10 | #16094 | `/tmp` default allowed workspace path | **Blocked by Finding A** — feature logic is correct, but v1 shared workspace factory can receive a bare request context without `projectPath`. |
| 11 | #16006 / #14962 / #14909 | Headless stdin, thread controls, model/mode CLI flags | **Likely works with caveat** — headless-specific paths are compatible, but default workspace turns remain blocked by Finding A. |
| 12 | #15036 | Browser automation support | **Works with caveat** — MastraCode wrapper and v1 core have separate browser propagation surfaces; current product path works, future native-v1 consumers may see divergence. |
| 13 | #14845 | Custom response for option questions | **Works with caveat** — TUI behavior works; v1 projection drops `selectionMode`, and custom response defaults true for sandbox prompt components too. |
| 14 | #14377 | Interactive `/mcp` selector | **Works with caveat** — selector uses `mcpManager` and works; native wrapper `harness.mcp.*` still exposes v1's separate/empty MCP catalog. |
| 15 | #13999 / #13437 | Shell passthrough + Workspace tool streaming | **Needs fix for v1 workspace tool streaming** — shell passthrough is TUI-local and works, but v1 ignores Workspace `data-sandbox-stdout`/`data-sandbox-stderr` chunks, so real-time process output does not become `shell_output`. |

### Blocking or fix-worthy findings

1. **Finding A — shared workspace request context lacks `projectPath`**
   - `getDynamicWorkspace()` requires `state.projectPath`, but v1 shared workspace acquisition can call the workspace factory with a bare `RequestContext()`.
   - Blocks or weakens #16618, #16094, headless default workspace turns, and any workspace-dependent first turn.

2. **Finding B — stale lease after restart**
   - Live smoke hit `HarnessSessionLockedError` on restart due to an existing stale session/thread lease.
   - Needs lifecycle/lease recovery validation before claiming robust restart behavior.

3. **#16231 persisted signal replay gap**
   - Update `convertStoredMessageToHarnessMessage()` so user-message signals preserve attributes and structured non-text content.
   - Add replay/history tests for `delivery:'while-active'` and file/image content.

4. **#16065 terminal system-reminder wake risk**
   - Separate "persist terminal goal/judge reminder" from "wake/interleave agent" semantics, or add guard tests proving terminal judge output does not wake unintentionally.

5. **#13891 custom mode memory propagation gap**
   - Mirror legacy `propagateRuntimeServicesToAgent()` for all static v1 mode agents returned by `toHarnessV1Agents()` when they do not own memory.
   - Add a custom-mode-agent memory override test.

6. **#13437 workspace streaming bridge gap**
   - Bridge v1 `data-sandbox-stdout` → `shell_output(stream:'stdout')` and `data-sandbox-stderr` → `shell_output(stream:'stderr')` while the tool is active.
   - Add a Harness v1 stream test that asserts the `shell_output` event arrives before `tool_end`.

### Architectural caveats to track

- **MCP catalog divergence:** MastraCode product path uses `mcpManager`; v1 native `session.mcp.*` reads Mastra's registered MCP servers. This affects #16548 and #14377 for future wrapper/native consumers.
- **Model catalog divergence:** `MastraCodeHarnessRuntime` constructs v1 with `models: []`; MastraCode wrapper methods provide the real dynamic model catalog/auth status. Future direct v1 model API use may not reflect Copilot/Codex/custom providers.
- **Browser propagation divergence:** MastraCode wrapper directly sets browsers on mode agents; v1 `Harness.setBrowser()` is a separate surface. Current product behavior works, but wrapper/core state can diverge.
- **OM per-thread ordering:** `observeAttachments` and `cavemanObservations` are handled through separate thread-state persistence. Startup is covered; non-startup `thread_created`/`thread_changed` ordering needs end-to-end v1 coverage.
- **Question projection shape:** v1 keeps `selectionMode`, but MastraCode legacy `ask_question` projection currently drops it.

### Validation run during audit

Representative focused validation passed across the audit:

- MastraCode runtime/TUI/headless/model/MCP/browser/OM/settings tests, including:
  - `src/harness/runtime.test.ts`
  - signal/follow-up queueing tests
  - headless argument/integration tests
  - `tool-execution-enhanced.test.ts`
  - MCP manager/config/dispatch tests
  - ask-question, parallel prompt, prompt handler tests
  - browser/settings runtime tests
- Core Harness v1 tests, including:
  - signal/message/list-message tests
  - goal/session tests
  - workspace runtime/session/policy tests
  - suspension/question tests
  - public view/display-state tests
  - MCP/session tests
  - provider registry tests
- Core Workspace/tool tests, including:
  - sandbox tools
  - workspace tools metadata/tracing
  - workspace path/safety tests
- Type checks:
  - `pnpm --pm-on-fail=ignore --filter mastracode check`
  - `pnpm --pm-on-fail=ignore --filter ./packages/core check`
  - package-specific `tsc --noEmit` checks for memory and related packages where touched.

Notable validation details:

- Several commands required `--pm-on-fail=ignore` because the local pnpm version check reports configured `10.29.3` vs current `11.3.0`.
- Some auth/model tests needed OpenAI env vars unset to avoid unrelated local credential leakage changing expected fallback behavior.
- Existing tests generally prove steady-state behavior; the main remaining gaps are first-turn workspace context, persisted signal replay, v1 streaming chunk normalization, and wrapper/native API divergence surfaces.

### Recommended follow-up PRs/tests

1. **Workspace context fix PR**
   - Ensure v1 shared workspace factories receive a harness request context with session state, or make MastraCode workspace resolution defer until session context is available.
   - Regression test: first `sendMessage()` on a fresh v1 MastraCode runtime resolves workspace with `projectPath` and does not throw `Project path is required`.

2. **Persisted signal replay PR**
   - Preserve user-message signal attributes and non-text content in `convertStoredMessageToHarnessMessage()`.
   - Regression tests for while-active label replay and image/file signal replay.

3. **Goal terminal reminder PR**
   - Split terminal reminder persistence from agent-wake behavior, or prove terminal reminders cannot trigger unwanted continuation.
   - Regression test around goal judged terminal output with no extra turn.

4. **Custom mode service propagation PR**
   - Inject `config.memory` into all static v1 mode agents that do not own memory.
   - Consider auditing browser/workspace/pubsub propagation similarly so v1 mirrors legacy runtime services.

5. **Workspace streaming bridge PR**
   - Normalize `data-sandbox-stdout`/`data-sandbox-stderr` in v1 `_drainStreamToEvents()`.
   - Regression test that Workspace `execute_command` streaming produces `shell_output` before `tool_end`.

6. **Restart/lease recovery test PR**
   - Reproduce stale session lease after process restart and define expected recovery behavior.

7. **Wrapper/native API alignment tests**
   - Decide whether `MastraCodeHarnessRuntime.mcp.*`, v1 model APIs, and browser state should reflect wrapper-managed dynamic providers/managers.
   - Add tests or document them as intentionally separate surfaces.

### Bottom line

The HEAD-reachable MastraCode feature queue has been fully audited against the Harness v1 runtime migration. Most recent feature surfaces are compatible through the wrapper paths, but the branch should not be called fully compatible until the fix-worthy issues above are addressed or explicitly accepted as follow-up work. The highest-priority fixes are: shared workspace `projectPath` context, persisted signal replay fidelity, custom mode memory propagation, terminal goal reminder wake semantics, and v1 Workspace `data-sandbox-*` streaming normalization.

---