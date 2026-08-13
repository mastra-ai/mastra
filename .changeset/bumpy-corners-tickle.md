---
'@mastra/core': patch
---

Fixed Anthropic thinking signature preservation in thread history. Signed reasoning now works on follow-up turns (#14559).

Fixed provider history handling for assistant messages that contain only reasoning. These messages are omitted when reasoning is stripped to prevent empty-content errors.
