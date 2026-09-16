---
'@mastra/inngest': patch
---

Fixed a crash risk in Inngest durable agents where failing to publish an error event to pubsub (for example when the realtime endpoint is unreachable) became an unhandled promise rejection instead of a logged warning. Error reporting is now best-effort: publish failures are caught and logged, matching how abort requests already behave.
