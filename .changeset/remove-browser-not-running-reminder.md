---
'@mastra/core': patch
---

Remove noisy "Browser is not currently running" system reminder.

**What changed**

- Removed the `isRunning` field from `BrowserContext` interface
- The `<system-reminder>` tag is now only injected when there's meaningful browser context (current URL or page title)
- Previously, the reminder was injected on every turn even when the user wasn't doing anything browser-related

This reduces noise in agent conversations when browser tools are available but not actively in use.
