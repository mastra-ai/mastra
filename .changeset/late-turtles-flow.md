---
'mastracode': minor
---

Improved MastraCode task tracking so agents keep stable task IDs in prompts and update one task at a time while working.

MastraCode now preserves Harness task IDs in state, includes those IDs in the current task list prompt, and replays structured task snapshots from full thread history when a thread reloads. The TUI keeps successful task updates quiet, shows task-tool failures inline, avoids duplicate completed-task summaries, and restores replayed tasks through the Harness display-state API.

MastraCode also documents the structured `task_check` result fields in agent guidance and keeps streaming `task_write` input typed separately from normalized task state.
