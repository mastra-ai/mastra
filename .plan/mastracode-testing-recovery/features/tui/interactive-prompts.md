# Interactive prompts and access requests

## Origin PR / commit

- PR: [#13696](https://github.com/mastra-ai/mastra/pull/13696) — queues parallel interactive tool prompts so concurrent `ask_user` / sandbox access requests do not overwrite each other.
- Later changes: [#13753](https://github.com/mastra-ai/mastra/pull/13753) — renames the sandbox request tool to `request_access`, expands `~`, and updates the active workspace filesystem immediately after approval; [#14479](https://github.com/mastra-ai/mastra/pull/14479) — wraps long free-text answers in inline question history/rendering so answered prompt boxes do not overflow terminal width; [#14845](https://github.com/mastra-ai/mastra/pull/14845) — adds a single-select `Custom response...` option that switches option prompts into free-text input when none of the predefined answers fit; [#14936](https://github.com/mastra-ai/mastra/pull/14936) — masks sensitive TUI input fields for API keys, login prompts, and storage connection strings; [#15395](https://github.com/mastra-ai/mastra/pull/15395) — adds multiline free-text question input for `ask_user` via `MultilineInput`, with Enter submit and Shift+Enter/backslash+Enter newline support; [#16274](https://github.com/mastra-ai/mastra/pull/16274) — adds shared modal question/overlay helpers for config prompts; [#17005](https://github.com/mastra-ai/mastra/pull/17005) — wraps long `ask_user` option labels in streaming, answered, and cancelled inline prompt states so bordered boxes do not overflow or crash the TUI; [#17054](https://github.com/mastra-ai/mastra/pull/17054) — replaces the inline option picker with a wrapping picker that uses `↳` continuation rows for long labels and supports fixed-option multi-select rendering; [#17334](https://github.com/mastra-ai/mastra/pull/17334) — renders `ask_user` `multi_select` prompts as true checkbox multi-select pickers and returns all selected labels as an array; [#17431](https://github.com/mastra-ai/mastra/pull/17431) — truncates any inline prompt line that still exceeds the bordered box's inner width on narrow terminals.

## User-visible behavior

- What the user can do: answer multiple interactive tool prompts sequentially when the agent triggers them in parallel, write multiline free-text `ask_user` answers with wrapping/newlines, choose a predefined option even when its label is long, read long option labels across `↳` continuation rows, toggle several `multi_select` options with Space and confirm them together with Enter, choose `Custom response...` to type an answer not present in a single-select option list, or enter sensitive values without echoing them in cleartext, including access requests for paths outside the project root.
- Success looks like: the first prompt stays active, later prompts wait their turn, every tool promise resolves after the user answers, multiline prompts submit raw text while using trim only for emptiness checks, multi-select prompts show checkbox rows and resolve to an array of selected labels, custom responses switch cleanly from select-list to input mode for single-select only, sensitive input renders as mask characters while submitting the raw value, long option labels and submitted answers wrap inside the bordered prompt box, picker rows stay within visible width, overflow leftovers are truncated to the inner width on narrow terminals, and aborting a run clears both the active prompt and queued prompts.
- Must preserve: no unreachable prompts, no editor input corruption, no answered-prompt terminal overflow, no custom-response sentinel leaking as the submitted answer, no sensitive prompt cleartext echo, no queued prompt activation after Ctrl+C/Escape/SIGINT abort.

## Entry points / commands

- Commands / shortcuts / flags: agent calls to `ask_user` and `request_access`; Enter submits free-text questions or confirms option pickers, Space toggles `multi_select` options, Shift+Enter or backslash+Enter inserts a newline in multiline `ask_user` prompts, Escape cancels; Ctrl+C/Escape abort handling.
- Automatic triggers: Harness prompt events handled by `handleAskQuestion()` and `handleSandboxAccessRequest()`.

## TUI states

- Idle: no active prompt.
- Active / modal / error: one `activeInlineQuestion` receives editor input; `ask_user` free-text prompts opt into `MultilineInput` when a TUI is available; additional prompt activations sit in `pendingInlineQuestions` until the active prompt submits/cancels.

## Headless / non-TUI behavior

- Supported: headless uses separate resolver behavior, not the inline TUI queue; prompt components fall back to single-line `Input` when no `TUI` instance is available.
- Not supported / unknown: this page only verifies TUI inline prompt queueing.

## Streaming / loading / interrupted states

- Streaming / loading: prompt events may arrive fire-and-forget while tools execute in parallel; queueing preserves the first active prompt; streaming `ask_user` components are created early and later activated with multiline input when the final question event arrives.
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
| Prompt label/answer wrapping, multi-select, and custom free text | `AskQuestionBorderedBox` wraps long option labels and free-text answers with `wrapTextWithAnsi()` plus continuation indentation and truncates over-wide lines with `truncateToWidth()`; `WrappingSelectList` wraps active picker labels with `↳` continuation rows, checkbox multi-select state, and item-based navigation; ask-question components' `Custom response...` sentinel switches select mode to input mode for single-select prompts only | Streaming/answered/cancelled inline question rendering, `ask_user` option prompts |
| Multiline free-text answers | `MultilineInput` wrapping `@mariozechner/pi-tui` `Editor`; `handleAskQuestion()` passes `multiline: true` + `state.ui` for inline/dialog `ask_user` | Paragraph/log answers, newline keybindings, wrapped active question input |
| Modal config questions | `askModalQuestion()` wrapping `AskQuestionDialogComponent` in `showModalOverlay()` | Config slash commands and startup/setup prompts that need focused modal input |
| Sensitive prompt masking | `MaskedInput` wrapper swaps rendered value for mask characters while preserving the real `Input` value for submit handlers | API-key dialog, OAuth/login prompt dialog, storage backend connection-string settings |
| Approved access paths | Harness `sandboxAllowedPaths` plus active `LocalFilesystem.setAllowedPaths()` | Same-turn and later workspace file tools |
| Abort cleanup | `tui/setup.ts` Ctrl+C/Escape/SIGINT handlers | Active/queued prompt state |

## Key files

- `mastracode/src/tui/handlers/prompts.ts` — inline prompt activation queue, `processNextInlineQuestion()`, and `ask_user` multiline opt-in for inline/dialog free-text answers.
- `mastracode/src/tui/components/ask-question-inline.ts` — inline question rendering, selected answer freeze state, `WrappingSelectList` option picker wiring, single-select custom-response mode switch, multiline input activation/fallback, long option/answer wrapping, and inner-width truncation fallback for narrow terminals.
- `mastracode/src/tui/components/ask-question-dialog.ts` — modal question rendering, multi-select `WrappingSelectList` option picker wiring, custom-response mode switch for option prompts, and multiline editor construction when a `TUI` is provided.
- `mastracode/src/tui/modal-question.ts` and `overlay.ts` — config-prompt modal wrapper and shared overlay sizing/min-height padding.
- `mastracode/src/tui/components/wrapping-select-list.ts` — visible-width-safe option picker with `↳` continuation rows, centered scroll windows, item-based navigation, and checkbox multi-select mode.
- `mastracode/src/tui/components/multiline-input.ts` — `Editor` wrapper with Enter submit, Shift+Enter/backslash+Enter newline handling, raw-text submit preservation, and border/scroll chrome stripping.
- `mastracode/src/tui/components/masked-input.ts` — masked rendering wrapper for sensitive input fields.
- `mastracode/src/tui/components/api-key-dialog.ts`, `login-dialog.ts`, and `settings.ts` — dialogs/settings menus that use masked input for provider keys, login prompts, and storage URLs.
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
- `mastracode/src/tui/components/__tests__/wrapping-select-list.test.ts` — `↳` continuation rows, visible-width bounds, item-to-item navigation, scroll indicators, and checkbox multi-select confirmation.
- No dedicated #17431 regression test was found for the final `truncateToWidth()` fallback in `AskQuestionBorderedBox`; existing long-label tests cover wrapped prompt labels at 80 columns.
- `mastracode/src/tui/components/__tests__/multiline-input.test.ts` — multiline submit/newline/escape/focus/render cleanup behavior.
- `mastracode/src/tui/components/__tests__/ask-question-inline-multiline.test.ts` — opt-in/fallback rules and hint text for multiline inline question input.
- `mastracode/src/tui/components/__tests__/ask-question-inline-multi-select.test.ts` — multi-select behavior and guard that `Custom response...` is omitted in multi-select mode.
- `mastracode/src/tui/components/__tests__/masked-input.test.ts` — sensitive input masking is render-only: cleartext never appears in rendered lines, the underlying value is restored after render, and submit forwards the unmasked value.
- `mastracode/scripts/mc-e2e/scenarios/api-key-prompt.ts` — partial real PTY coverage for sensitive prompt behavior: opens `/api-keys`, selects an unset provider, types a fake key, asserts cleartext is absent and mask characters are visible, then verifies the provider becomes stored.
- `mastracode/scripts/mc-e2e/scenarios/request-access-modal.ts` — real PTY coverage for AIMock-driven `request_access`: model calls the real tool, the TUI renders the sandbox access prompt with reason/options, Enter approves the default Yes option, the tool returns an access-granted result, and a follow-up `view` reads a deterministic file outside the project root from the newly approved path.
- `mastracode/scripts/mc-e2e/scenarios/ask-user-advanced-prompts.ts` — real PTY coverage for AIMock-driven `ask_user` prompt shapes: multiline free-text input with backslash+Enter newline insertion, single-select `Custom response...` switching to free text, and fixed-option `multi_select` prompts toggled with Space and confirmed with Enter.
- `mastracode/src/tui/__tests__/overlay.test.ts` — shared modal overlay min-height, max-height cap, and top-padding behavior.
- `mastracode/src/tools/__tests__/request-sandbox-access.test.ts` — approve/deny outcomes, tilde expansion, same-turn `setAllowedPaths()`, missing filesystem fallback, and no-`setAllowedPaths` fallback.

## Missing tests

- Full TUI/keyboard integration test proving real editor focus routes to the next queued prompt after the first answer.
- Direct regression test for long answered free-text values overflowing the inline bordered box.
- Direct dialog regression test that selecting `Custom response...` in dialog single-select prompts switches to free-text input, preserves focus, and submits the typed answer rather than the sentinel value.
- Direct `askModalQuestion()` regression proving submit/cancel hide the overlay and resolve the expected value; `/api-keys` masked dialog e2e exists but does not cover shared ask-modal submit/cancel values.
- Regression test for queued prompts interleaved with tool approvals or plan approval.
- Headless parallel prompt behavior, if non-TUI auto-resolution needs similar queueing guarantees.

## Known risks / regressions

- `activeInlineQuestion` remains a single input target; any new prompt-like component must either use the queue or a separate focus state intentionally.
- Abort cleanup must stay in sync between editor Ctrl+C/Escape and process SIGINT paths.
- Streaming components reused for `ask_user` must not be overwritten by later parallel tool calls before activation.
- Prompt answer rendering must pass the correct available width to `wrapTextWithAnsi()` before colorizing text; wrapping after ANSI styling or using full box width can reintroduce overflow.
- Picker labels use item-based navigation while labels can occupy multiple rows; future changes must keep selection index movement independent from rendered row count.
- Sensitive dialogs now rely on the wrapper temporarily mutating the inner input value during render; future `Input` changes could expose cleartext if the restore path regresses.
- Custom response is intentionally single-select only; multi-select prompts must keep a fixed option set so callback shape remains predictable.
- Multiline prompts preserve raw leading/trailing whitespace on submit; callers that expect trimmed values must opt into single-line input or trim explicitly.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
