---
'@mastra/factory': minor
---

A card on a workflow board shows what its board run is doing. The card's details list its state (resting, waiting to start, running, checking in, waiting for approval, needs attention or finished), phase, probes, failed attempts and last outcome, read from the new `GET /web/factory/projects/:id/work-items/:workItemId/run-state` route (`mastra api factory work-item run-state <project-id> <work-item-id>`). A card that needs attention says why on the board instead of the generic failure, and its activity shows when and why it needed attention, recorded as the new audit action `factory.work_item.needs_attention`. `runStopped` now also takes who stopped the card (`FactoryStoppedBy`: user id, profile and request origin), which goes on the audit trail only. The default board engine records no run state, so its cards look as before.
