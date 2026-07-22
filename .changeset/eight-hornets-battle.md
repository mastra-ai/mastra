---
'@mastra/code-sdk': patch
---

Fixed provider request history repair so incompatible tool-call IDs are sanitized and retried instead of being blindly resent after a provider rejects the request
