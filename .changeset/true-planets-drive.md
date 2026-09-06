---
'@mastra/core': patch
---

Fixed workflow tools losing tripwire details. Workflow tools now return the native tripwire status, reason, retry option, metadata, processor ID, and run ID so parent guardrails can inspect the result. This does not automatically stop the parent or change ordinary workflow failure results.
