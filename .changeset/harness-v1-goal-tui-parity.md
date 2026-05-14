---
"@mastra/core": minor
---

Harness v1 goal API — TUI continuation-wording parity, no-assistant fallback, and `updateJudgeDefaults`.

- `setGoal` kickoff continuation is now wrapped in `<system-reminder type="goal">${objective}</system-reminder>` (XML-escaped), matching `mastracode` TUI's `createGoalReminderXml`.
- `resumeGoal` continuation is now plain text `Continue working toward the goal: ${objective}` (no system-reminder wrapper), matching the TUI's `/goal resume` semantics.
- Judge `continue` verdicts now use the full `[Goal attempt N/M] The goal is not yet complete. Judge feedback: ${reason}\n\nContinue working toward the goal: ${objective}` template wrapped in `<system-reminder type="goal-judge">`.
- Added the TUI's no-assistant-message fallback: when the judge has no assistant content to score, the harness enqueues `[Goal attempt N/M] ... Judge feedback: No response yet, keep working. ...` instead of calling the judge. Respects the `maxTurns` budget.
- Added `Session.updateJudgeDefaults({ judgeModelId?, maxTurns? })` so consumers can re-point the judge model or budget on an in-flight goal without clearing it.
- `_getJudgeContext` now falls back to the in-memory turn text when storage hasn't committed the assistant message yet (more robust against memory-store wiring variations).
