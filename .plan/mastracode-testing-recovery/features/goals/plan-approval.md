# Plan approval and build handoff

## Origin PR / commit

- PR: [#13416](https://github.com/mastra-ai/mastra/pull/13416) — fixed Plan mode so the agent calls `submit_plan` instead of only writing plan text.
- Later changes: [#13557](https://github.com/mastra-ai/mastra/pull/13557) — persists approved plans as Markdown files on disk; [#13598](https://github.com/mastra-ai/mastra/pull/13598) — keeps the submitted plan visible while the user types requested-change feedback; [#16065](https://github.com/mastra-ai/mastra/pull/16065) — adds `Use as /goal` from the plan approval UI so approved plans can enter persistent goal pursuit; [#16340](https://github.com/mastra-ai/mastra/pull/16340) — fixes `Use as /goal` ordering so the suspended plan tool resolves before the goal reminder starts Build-mode execution.

## User-visible behavior

- What the user can do: ask for a plan in Plan mode, receive an inline rendered plan approval card, then approve, start as a goal, reject, or request changes.
- Success looks like: the plan appears in the approval UI; approval switches/hands off to Build-mode execution; request-changes keeps the plan visible while collecting feedback; rejection keeps the agent in Plan mode with feedback.
- Must preserve: `submit_plan` tool call requirement, inline plan rendering in every approval sub-mode, approval/rejection resolver semantics, best-effort plan file persistence, and single handoff signal after approval.

## Entry points / commands

- Commands / shortcuts / flags: `/mode plan`, Plan mode prompt, `submit_plan` built-in tool, plan approval inline UI.
- Automatic triggers: `submit_plan` emits `plan_approval_required`; TUI dispatch calls `handlePlanApproval()`; approval calls `respondToPlanApproval()` and then starts Build-mode work or a goal.

## TUI states

- Idle: user can switch to Plan mode and ask for a plan.
- Active / modal / error: streamed `submit_plan` args render in a purple inline plan box; approval UI takes focus; request-changes rebuilds the component with the plan still visible above the feedback input; reject/request-changes resolves back to the suspended Plan-mode tool.

## Headless / non-TUI behavior

- Supported: core `submit_plan` falls back to text output when no harness plan approval callbacks exist.
- Not supported / unknown: no verified headless approval UI; non-interactive behavior depends on harness/tool resolver availability.

## Streaming / loading / interrupted states

- Streaming / loading: `tool_input_start` for `submit_plan` creates a streaming `PlanApprovalInlineComponent`; `tool_input_delta` updates title/plan as args stream; `plan_approval_required` activates the same component in place.
- Abort / retry / resume: approving saves the plan best-effort, calls `respondToPlanApproval({ planId, response: { action: 'approved' } })`, waits for the Plan-mode run to settle, then sends one structured system-reminder signal for Build-mode execution. `Use as /goal` follows the same resolver-first ordering, then starts the canonical goal reminder instead of sending the regular build reminder.

## Streaming vs loaded-from-history behavior

- While actively streaming: plan args and approval controls live in `PlanApprovalInlineComponent` and `state.activeInlinePlanApproval`.
- After reload / history reconstruction: `renderExistingMessages()` replaces persisted `submit_plan` tool calls/results with `PlanResultComponent`, showing approved/rejected/requested-change status without reopening controls.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Plan text/title while streaming | Harness tool input buffer + `PlanApprovalInlineComponent` | TUI plan card |
| Pending plan approval | Core Harness resolver map + `plan_approval_required` event | TUI handler, display state |
| Active plan approval UI | `TUIState.activeInlinePlanApproval` / `lastSubmitPlanComponent` + component-local `planTitle`/`planContent` | Input focus, chat renderer, feedback sub-mode |
| Approval result | Core Harness `respondToPlanApproval()` | Suspended `submit_plan` tool, persisted tool result |
| Approved plan files | `savePlanToDisk()` + app data / `MASTRA_PLANS_DIR` | User archive/reference outside chat history |
| Build/goal handoff | TUI prompt handler + goal manager; `respondToPlanApproval()` resolves before either build signal or `/goal` start | Harness signal / `/goal` flow |

## Key files

- `mastracode/src/agents/prompts/plan.ts:60` — Plan mode tells the agent to call `submit_plan` immediately when the plan is complete.
- `mastracode/src/agents/prompts/tool-guidance.ts:208` — mode-aware tool guidance includes `submit_plan` only in Plan mode when not denied.
- `packages/core/src/harness/tools.ts:128` — built-in `submit_plan` tool emits approval event and waits for resolver response.
- `mastracode/src/tui/handlers/tool.ts:199` and `:300` — `submit_plan` uses `PlanApprovalInlineComponent` instead of a generic tool box.
- `mastracode/src/tui/handlers/prompts.ts:266` — `handlePlanApproval()` wires approve / goal / reject actions.
- `mastracode/src/utils/plans.ts` — `savePlanToDisk()` writes timestamped Markdown under app data or `MASTRA_PLANS_DIR`.
- `mastracode/src/tui/components/plan-approval-inline.ts` — inline plan approval and persisted plan-result components.
- `mastracode/src/tui/render-messages.ts:828` — history reconstruction renders `submit_plan` results as resolved plan cards.

## Dependencies / related features

- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — Plan mode is one of the runtime modes.
- [Prompt context and project instructions](../chat/prompt-context.md) — prompt assembly injects Plan-mode and tool guidance.
- [Core Harness API and reference docs](../integrations/harness-api.md) — approval uses object-param Harness APIs.
- [Interactive TUI chat](../tui/interactive-chat.md) — plan cards render inside chat history/streaming UI.
- [Persistent `/goal` mode](./persistent-goals.md) — `Use as /goal` delegates approved plan execution to the judge-driven goal loop.

## Existing tests

- `mastracode/src/agents/__tests__/prompts.test.ts` — Plan mode prompt includes `submit_plan` and goal-ready plan guidance.
- `mastracode/src/tui/handlers/__tests__/prompts.test.ts` — approval sends one build handoff signal; goal option delegates to `/goal`; streamed component activates in place.
- `mastracode/src/tui/components/__tests__/plan-approval-inline.test.ts` — inline plan card renders, goal option exists, feedback/requested-changes display works, and feedback mode forces a full redraw.
- `mastracode/src/utils/__tests__/save-plan.test.ts` — approved plan file names/content, resource subdirectories, special-character titles, and timestamp non-overwrite behavior.
- `packages/core/src/harness/display-state.test.ts` — `pendingPlanApproval` display state is set/cleared by plan approval events.
- `packages/core/src/harness/mode-model-persistence.test.ts` — `respondToPlanApproval()` resolves plan approvals without aborting the resolver signal prematurely.
- `packages/core/src/harness/tracing-propagation.test.ts` — regression for stale abort state before a new message/goal-triggered run.

## Missing tests

- Full Plan-mode run where model streams `submit_plan` args, user approves, Build mode starts, plan file is persisted, and persisted history reloads as a resolved plan card.
- Headless/non-TUI behavior for `submit_plan` approval fallback and resolver absence.
- Regression test that denied `submit_plan` removes Plan-mode tool guidance and prevents accidental text-only plan completion.
- Mapping test for the later PR that added `Use as /goal` to plan approval UI.
- Direct assertion that feedback mode itself keeps the full submitted plan visible while typing requested changes, not only after feedback is submitted.

## Known risks / regressions

- If prompt/tool guidance omits `submit_plan`, Plan mode can regress to plain text plans that cannot be approved.
- Live plan card and loaded-from-history plan result use different components; status parsing from tool result text can drift.
- Feedback mode clears and rebuilds the live component; future changes must preserve the title/content before switching modes.
- Approval handoff must send exactly one system-reminder signal; duplicate `addUserMessage` / `fireMessage` paths previously risked duplicate execution triggers.
- Goal handoff is current behavior but the exact origin PR is not mapped yet.
- Plan-file persistence is best-effort by design; a write failure should be visible enough for debugging without blocking approval/build handoff.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
