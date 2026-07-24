---
'@mastra/core': patch
---

Fix "No model selected" when a deferred notification wakes an idle thread. The dispatcher starts a fresh run on wake but carries no request context or model selection, so the woken run had no model. Signal providers can now implement `getNotificationStreamOptions(target)` (routed by `notificationSource`); the dispatcher resolves these at send time and attaches them to the wake target's `ifIdle.streamOptions`, so the woken run has the request context and model it needs. Resolved at dispatch because stream options carry live, non-serializable state that cannot be persisted on the record.
