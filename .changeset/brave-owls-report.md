---
'@mastra/factory': minor
---

Factory user sessions can now start sub-sessions and hear back from them.

- `factory_start_session` starts a side session with a prompt, or a role on a work item (like pressing **Start**, without moving the card). New sessions run as the caller, with the caller's credentials, and the caller follows the work item.
- Spawned sessions report with `factory_message_origin`. A side session reports to the session that started it; a work-item session reports to everyone following the item. `failed` and `blocked` reports are urgent, `done` is high priority, and `progress` updates replace each other while unread.
- Every run of a spawned session ends with exactly one final report: if the agent doesn't send `done` or `failed`, Factory sends one when the run ends.
- Followed items send a low-priority notice to running sessions when they change stage.
- A `<factory-sessions>` state signal shows a session the side sessions it started and the work items it follows, once there is something to show.
