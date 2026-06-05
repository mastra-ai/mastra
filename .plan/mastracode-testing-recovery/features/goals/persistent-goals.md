# Persistent `/goal` mode

## Origin PR / commit

- PR: [#16065](https://github.com/mastra-ai/mastra/pull/16065) — adds persistent `/goal` mode and judge-driven continuation loop.
- Later changes: [#16322](https://github.com/mastra-ai/mastra/pull/16322) — keeps multiline `/goal` objectives, goal-enabled custom slash commands/skills, and user choices intact while goal mode is active; [#16340](https://github.com/mastra-ai/mastra/pull/16340) — ensures approving a plan as `/goal` first resolves the suspended plan approval, then starts the canonical goal reminder as a fresh build-mode run; [#16231](https://github.com/mastra-ai/mastra/pull/16231) — routes judge continuations through the same Agent signal path as active-run follow-ups; [#16654](https://github.com/mastra-ai/mastra/pull/16654) — improves judge UX with explicit `waiting` decisions, retry-on-empty-output, judge-failure resume, readonly judge-tool activity, and active judge status-line mode; [#16690](https://github.com/mastra-ai/mastra/pull/16690) — tracks active pursuit time only while the agent/judge is actually working; [#16676](https://github.com/mastra-ai/mastra/pull/16676) — returns approved-plan goals to Plan mode after the goal is completed; [#16843](https://github.com/mastra-ai/mastra/pull/16843) — codifies judge max-steps/retry behavior and makes `/goal resume` retrigger a failed judge evaluation before normal continuation.

## User-visible behavior

- What the user can do: run `/goal <objective>` to pursue a cross-turn objective, check `/goal status`, pause/resume/clear, set `/judge` defaults, or start an approved plan as a goal.
- Success looks like: the judge evaluates each assistant turn, marks the goal done/waiting, pauses on failure/budget, retries once when structured output is missing, or sends a structured continuation reminder; user follow-ups and allowed escape commands take precedence over automatic continuation.
- Must preserve: thread-persisted goal state, judge model/max-turn defaults, active-time accounting, plan approval resolver ordering before goal start, plan-mode return after approved-goal completion, input locks during judge evaluation, and slash/custom command text preservation.

## Entry points / commands

- Commands / shortcuts / flags: `/goal`, `/goal status`, `/goal pause`, `/goal resume`, `/goal clear`, `/judge`, plan approval `Use as /goal`, goal-enabled custom slash commands and skills such as `/goal/<name>`.
- Automatic triggers: `handleAgentEnd()` runs the judge after completed turns; continuation sends a `system-reminder` signal with goal metadata.

## TUI states

- Idle: goal status appears in the status line as `pursuing goal ({duration})`; `/goal` commands can inspect or mutate the thread goal.
- Active / modal / error: `JudgeDisplayComponent` shows judge progress; editor submissions and most slash commands are blocked while the judge is evaluating, except `/goal pause`, `/goal clear`, and `/exit`.

## Headless / non-TUI behavior

- Supported: goal state is stored in thread metadata and the manager is Harness-backed.
- Not supported / unknown: interactive `/goal` and `/judge` selection flows are TUI command flows; no verified non-TUI goal loop UX.

## Streaming / loading / interrupted states

- Streaming / loading: judge activity lines stream into `JudgeDisplayComponent`; the status line switches to a blue `judge` badge/model while evaluation is active; continuation reminders route through normal signal handling.
- Abort / retry / resume: keyboard abort marks the judge interrupted; missing structured output gets one retry prompt; judge failures pause with `lastPauseWasJudgeFailure` so `/goal resume` retries judgment instead of sending main-agent continuation.

## Streaming vs loaded-from-history behavior

- While actively streaming: `GoalManager` tracks active timers, judge state, and pending continuations in TUI state.
- After reload / history reconstruction: `loadFromThreadMetadata()` restores goal fields; persisted `activeStartedAt` is not counted as still-active time after restart.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Active goal | thread metadata key `goal` + `GoalManager` in `TUIState`; `activeStartedAt` / `activeDurationMs` accumulate only while turns or judge retries are in flight | `/goal` command, status line duration label, lifecycle continuation |
| Judge defaults | settings `models.goalJudgeModel` / `goalMaxTurns` | `/judge`, `startGoalWithDefaults()`, plan approval goal start |
| Judge run state | `activeGoalJudge`, abort controller, `JudgeDisplayComponent`, `lastPauseWasJudgeFailure`, and `JUDGE_MAX_STEPS`/retry prompt constants | input lock, keyboard abort, lifecycle cleanup, `/goal resume` judge retry |
| Goal continuations | `GoalManager.evaluateAfterTurn()` decision + structured Agent `system-reminder` signal | Harness signal path, subscribed chat history, next agent turn |
| Approved-plan goal start/return | `handlePlanApproval().onGoal` resolves `respondToPlanApproval()` before `ctx.startGoal()` and records `planStartedGoalId`; lifecycle switches back to Plan mode when that goal finishes | suspended plan tool, Build-mode start, goal completion return-to-plan behavior |
| Goal command text | command-dispatch raw-arg handling + custom editor autocomplete completion | multiline `/goal` objectives, `/goal/<custom>` and `/goal/<skill>` routes |

## Key files

- `mastracode/src/tui/goal-manager.ts` — goal persistence, judge agent creation, decision handling, continuation prompt construction, active-time tracking via `startActiveTimer()` / `stopActiveTimer()`.
- `mastracode/src/tui/commands/goal.ts` — `/goal` and `/judge` command flows, judge default prompts, plan-goal entrypoint helpers, and manual-goal/clear cleanup for `planStartedGoalId`.
- `mastracode/src/tui/handlers/agent-lifecycle.ts` — post-turn judge evaluation, queued-action precedence, continuation signal dispatch, done/waiting/pause handling, active-timer stop on abort/error, and Plan-mode return when `planStartedGoalId` completes.
- `mastracode/src/tui/goal-input-lock.ts` and `setup.ts` — input lock rules and keyboard abort during judge evaluation.
- `mastracode/src/tui/handlers/prompts.ts` — plan approval `Use as /goal` ordering: resolve the suspended plan approval, start the goal, then remember `planStartedGoalId`.
- `mastracode/src/tui/command-dispatch.ts` and `components/custom-editor.ts` — preserve raw multiline `/goal` objectives and slash autocomplete text.
- `mastracode/src/tui/components/judge-display.ts` and `status-line.ts` — judge UI, activity-line rendering, active judge mode badge/model display, and goal duration label.

## Dependencies / related features

- [Plan approval and build handoff](./plan-approval.md) — approved plans can become goals and return to Plan mode when the goal completes.
- [Agent signals and streaming follow-ups](../chat/agent-signals.md) — goal continuations are structured system-reminder signals.
- [Queued follow-ups and slash commands](../chat/queued-followups.md) — user queued messages/actions preempt automatic goal continuation.
- [Interactive prompts and access requests](../tui/interactive-prompts.md) — goal-mode ask_user prompts remain user-controlled.
- [Prompt context and project instructions](../chat/prompt-context.md) — goal/task prompt guidance is injected into agent context.

## Existing tests

- `mastracode/src/tui/__tests__/goal-manager.test.ts` — persistence, judge decisions including `waiting`, active duration, judge failure resume, budget exhaustion, retry-on-empty-output, readonly judge tools, activity reporting, and processor wiring.
- `mastracode/src/tui/commands/__tests__/goal.test.ts` — `/goal` command lifecycle, defaults, continuation failure, plan-mode completion handling, and pending-thread creation.
- `mastracode/src/tui/__tests__/mastra-tui-queueing.test.ts` — editor lock during judge, queued action precedence, pending signal behavior.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` and `setup-keyboard-shortcuts.test.ts` — multiline `/goal` raw args, `/goal/<custom>`/skill routing, judge input locks/escape hatches, autocomplete, and abort shortcuts.
- `mastracode/src/tui/handlers/__tests__/prompts.test.ts` and `parallel-interactive-prompts.test.ts` — ask_user prompts remain user-controlled during active goals, and plan approval goal mode resolves the suspended plan before starting `/goal` without sending a duplicate build reminder.

## Missing tests

- End-to-end run that starts a real `/goal`, completes several model turns including a `waiting` checkpoint, reloads, resumes, and verifies persisted status/duration/history.
- Non-TUI/headless behavior for goal state and continuation when slash-command UI is unavailable.
- Snapshot coverage for narrow status-line fallback with active goal, judge badge, OM badge interactions, and long model IDs.

## Known risks / regressions

- The judge loop depends on transient lifecycle ordering: queued user actions must drain before continuation, plan approval must resolve before abort/mode switch/goal start, and judge failure resume must not accidentally send stale continuation prompts or skip the no-assistant-response guard.
- Goal commands intentionally bypass some normal slash-command argument splitting; future command parser changes can break multiline objective preservation.
- Judge agents use readonly workspace tools and provider processors; expanding tool access or prompt context can make judge decisions slower or less deterministic.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
