---
'@mastra/factory': minor
---

Factory user sessions can now start sub-sessions and hear back from them.

- `factory_start_session` starts a side session with a prompt, or a role on a work item (like pressing **Start**, without moving the card). New sessions run as the caller, with the caller's credentials, and the caller follows the work item.
- Spawned sessions report with `factory_message_origin`. A side session reports to the session that started it; a work-item session reports to everyone following the item. `failed` and `blocked` reports are urgent, `done` is high priority, and `progress` updates replace each other while unread.
- Every run of a work session or side session ends with exactly one final report, however the run started (the board, a typed message, a wake, or after a restart): if the agent doesn't report, Factory sends `done`, `failed`, or `blocked` when the run ends, including when it stops waiting for someone to approve a tool call.
- When a work session or side session holds a tool call for approval, whoever follows it gets an urgent `approval` notification right away and can approve or decline it with `factory_answer_approval`.
- Followed items send a low-priority notice to running sessions when they change stage.
- A `<factory-sessions>` state signal shows a session the side sessions it started and the work items it follows, once there is something to show.
