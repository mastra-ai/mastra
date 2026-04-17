---
'@mastra/core': minor
'@mastra/memory': minor
---

Added activateAfterIdle setting for observational memory so buffered observations can activate after idle time before the next prompt.

**Example**

Set `activateAfterIdle: 300_000` (or `"5m"`) on the `observationalMemory` config to activate buffered context after 5 minutes of inactivity.

This helps long-running threads reuse compressed context after prompt cache TTLs expire instead of sending a larger raw message window on the next request.
