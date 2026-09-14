---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/client-js': patch
---

Let a UI list and remove queued follow-ups. `displayState.queuedFollowUpItems` carries each queued follow-up's stable `id` and `content` next to the existing `queuedFollowUps` count, the `follow_up_queued` event carries the same `items`, `session.followUps.list()` / `session.followUps.remove(id)` and `session.removeFollowUp({ id })` expose the queue on the session, and `DELETE /agent-controller/:controllerId/sessions/:resourceId/follow-up/:followUpId` (client: `session.removeFollowUp(id)`) removes one queued message without disturbing the rest.
