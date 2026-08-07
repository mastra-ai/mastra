---
'@mastra/github-signals': patch
---

Fixed a shut-down provider continuing to poll GitHub. Stopping the provider now clears its per-thread polling timers, so a provider that is replaced or disabled stops calling GitHub and stops sending notifications.
