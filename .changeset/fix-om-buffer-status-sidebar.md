---
'@mastra/playground-ui': patch
---

Skip `awaitBufferStatus` calls when observational memory is disabled. Previously the Studio sidebar would unconditionally hit `/memory/observational-memory/buffer-status` after every agent message, which returns a 400 when OM is not configured and halts agent execution.
