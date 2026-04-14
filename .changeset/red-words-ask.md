---
'@mastra/core': minor
'@mastra/memory': minor
---

Added activationTTL support for observational memory so buffered observations can activate after idle time before the next prompt.

**Example**

Set `activationTTL: 300_000` on observation or reflection config to activate buffered context after 5 minutes of inactivity.

This helps long-running threads reuse compressed context after prompt cache TTLs expire instead of sending a larger raw message window on the next request.
