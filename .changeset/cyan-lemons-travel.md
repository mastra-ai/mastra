---
'@mastra/core': patch
---

Fixed Anthropic API rejection of empty user text content blocks.

User messages containing only empty text parts (e.g., `{ type: 'text', text: '' }`) are now filtered out before being sent to the LLM. This prevents the "text content blocks must be non-empty" error that could occur when corrupted messages existed in the database.

Note: The root cause of how these empty user messages get persisted is still under investigation.
