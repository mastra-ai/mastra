# Interactive prompts and access requests

## Origin PR / commit

- PR: [#13696](https://github.com/mastra-ai/mastra/pull/13696) — queues parallel interactive tool prompts so concurrent `ask_user` / sandbox access requests do not overwrite each other.
- Later changes: [#13753](https://github.com/mastra-ai/mastra/pull/13753) — renames the sandbox request tool to `request_access`, expands `~`, and updates the active workspace filesystem immediately after approval; [#14479](https://github.com/mastra-ai/mastra/pull/14479) — wraps long free-text answers in inline question history/rendering so answered prompt boxes do not overflow terminal width.

## User-visible behavior

- What the user can do: answer multiple interactive tool prompts sequentially when the agent triggers them in parallel, including access requests for paths outside the project root.
- Success looks like: the first prompt stays active, later prompts wait their turn, every tool promise resolves after the user answers, long submitted answers wrap inside the bordered prompt box, and aborting a run clears both the active prompt and queued prompts.
- Must preserve: no unreachable prompts, no editor input corruption, no answered-prompt terminal overflow, no queued prompt activation after Ctrl+C/Escape/SIGINT abort.

## Entry points / commands

- Commands / shortcuts / flags: agent calls to `ask_user` and `request_access`; Ctrl+C/Escape abort handling.
- Automatic triggers: Harness prompt events handled by `handleAskQuestion()` and `handleSandboxAccessRequest()`.

## TUI states

- Idle: no active prompt.
- Active / modal / error: one `activeInlineQuestion` receives editor input; additional prompt activations sit in `pendingInlineQuestions` until the active prompt submits/cancels.

## Headless / non-TUI behavior

- Supported: headless uses separate resolver behavior, not the inline TUI queue.
- Not supported / unknown: this page only verifies TUI inline prompt queueing.

## Streaming / loading / interrupted states

- Streaming / loading: prompt events may arrive fire-and-forget while tools execute in parallel; queueing preserves the first active prompt.
- Abort / retry / resume: Ctrl+C/Escape and SIGINT clear `activeInlineQuestion` and empty `pendingInlineQuestions` before aborting Harness.

## Streaming vs loaded-from-history behavior

- While actively streaming: queue state is transient TUI state.
- After reload / history reconstruction: no queued prompt state is restored from history.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Active inline prompt | `TUIState.activeInlineQuestion` | Editor input routing, prompt handlers |
| Queued inline prompts | `TUIState.pendingInlineQuestions` | Prompt handlers, abort cleanup |
| Prompt resolution | Core Harness pending prompt/question resolver | `ask_user`, `request_access` |
| Answered prompt wrapping | `AskQuestionBorderedBox` answer render path using `wrapTextWithAnsi()` and continuation indentation | Inline question history/live answered-state rendering |
| Approved access paths | Harness `sandboxAllowedPaths` plus active `LocalFilesystem.setAllowedPaths()` | Same-turn and later workspace file tools |
| Abort cleanup | `tui/setup.ts` Ctrl+C/Escape/SIGINT handlers | Active/queued prompt state |

## Key files

- `mastracode/src/tui/handlers/prompts.ts` — inline prompt activation queue and `processNextInlineQuestion()`.
- `mastracode/src/tui/components/ask-question-inline.ts` — inline question rendering, selected answer freeze state, long option/answer wrapping.
- `mastracode/src/tui/state.ts` — `activeInlineQuestion` and `pendingInlineQuestions` state.
- `mastracode/src/tui/setup.ts` — Ctrl+C/Escape/SIGINT cleanup for active and queued prompts.
- `mastracode/src/tui/__tests__/parallel-interactive-prompts.test.ts` — regression coverage for parallel prompt queueing and abort cleanup.
- `mastracode/src/tools/request-sandbox-access.ts` — `request_access` path normalization, approval event emission, Harness state update, and same-turn filesystem update.

## Dependencies / related features

- [Interactive TUI chat](./interactive-chat.md) — editor input routing and active run lifecycle.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — `request_access` is part of the tool/permission surface.
- [Plan approval and build handoff](../goals/plan-approval.md) — plan approval has a separate active inline state and should not be conflated with queued questions.

## Existing tests

- `mastracode/src/tui/__tests__/parallel-interactive-prompts.test.ts` — concurrent `ask_user`, concurrent sandbox access, mixed prompt types, and abort-clears-queue behavior.
- `mastracode/src/tui/components/__tests__/ask-question-inline-long-labels.test.ts` — long option-label wrapping; #14479 adds the same render-path concern for long free-text answers.
- `mastracode/src/tools/__tests__/request-sandbox-access.test.ts` — approve/deny outcomes, tilde expansion, same-turn `setAllowedPaths()`, missing filesystem fallback, and no-`setAllowedPaths` fallback.

## Missing tests

- Full TUI/keyboard integration test proving real editor focus routes to the next queued prompt after the first answer.
- Direct regression test for long answered free-text values overflowing the inline bordered box.
- Regression test for queued prompts interleaved with tool approvals or plan approval.
- Headless parallel prompt behavior, if non-TUI auto-resolution needs similar queueing guarantees.

## Known risks / regressions

- `activeInlineQuestion` remains a single input target; any new prompt-like component must either use the queue or a separate focus state intentionally.
- Abort cleanup must stay in sync between editor Ctrl+C/Escape and process SIGINT paths.
- Streaming components reused for `ask_user` must not be overwritten by later parallel tool calls before activation.
- Prompt answer rendering must pass the correct available width to `wrapTextWithAnsi()` before colorizing text; wrapping after ANSI styling or using full box width can reintroduce overflow.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
