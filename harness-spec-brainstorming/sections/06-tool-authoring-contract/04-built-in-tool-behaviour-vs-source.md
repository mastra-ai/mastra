### 6.4 Built-in tool behaviour vs `source`

The built-in tools (`task_write`, `submit_plan`, `ask_user`) read `source` to keep parent and subagent state isolated:

- **`task_write`** — writes to the calling session's task list. A subagent's task list is separate from the parent's; calling `task_write` from a subagent never overwrites the parent's tasks. (The mechanism: tasks live in `session.state`, and there are two sessions involved.)
- **`submit_plan`** — registers a plan approval against the calling session. When approved by the user, the harness flips the calling session's mode (typically plan → build). A subagent's `submit_plan` flips the subagent's mode, never the parent's. The user-facing event is tagged with `source` so the UI can attribute it ("subagent X submitted a plan").
- **`ask_user`** — registers a pending question against the calling session. The user sees the question with subagent attribution if `source === 'subagent'`.

Custom tool authors implementing similar suspension patterns should follow the same rule: act on the calling session only, and tag user-facing events with `source` for attribution.
