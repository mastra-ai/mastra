---
'@mastra/core': minor
'mastracode': patch
---

Made the native Agent goal mechanism robust, restoring behavior that regressed when goal handling moved into core.

- **Tool-capable judges.** Scorer judge configs accept optional `tools`, and the default goal scorer can use them to verify the agent's work against reality instead of grading prose alone. MastraCode wires its read-only workspace tools (`view`, `search_content`, `find_files`, `file_stat`, `lsp_inspect`) into `goal.tools`.
- **Judge memory restored.** Scorer judge configs accept optional `memory`; goal scoring uses the original MastraCode per-goal judge thread shape and prompt format so repeated evaluations retain prior facts, feedback, and user checkpoints through judge memory.
- **Tri-state waiting.** The default goal scorer emits `done`/`continue`/`waiting`; a `waiting` decision (only when the goal text explicitly asks to stop for the user) stops the auto-loop but keeps the objective `active` so the next agent turn is still judged — no `/goal resume` needed.
- **Budget-exhaustion pause.** Reaching `maxRuns` without completing now parks the objective as `paused` with a clear reason, resumable by raising `maxRuns` and reactivating, instead of silently leaving it `active`.
- **Judge-failure pause (no infinite loop).** Any failure while evaluating the goal — including judge-model/tools resolution, not just the scorer run — pauses the objective and stops the loop, surfacing the cause, rather than re-running the model against a broken judge every turn.
- **Structured-output retry.** `tryGenerateWithJsonFallback` now retries with `jsonPromptInjection` when the judge resolves without a parseable object (not only on a thrown error), matching the streaming path.

The goal evaluation chunk now carries `pausedReason`, `judgeFailed`, `waitingForUser`, and `pending` (emitted before scoring starts so consumers can show a loading indicator).
