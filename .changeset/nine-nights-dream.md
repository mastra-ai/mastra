---
'@mastra/core': patch
---

Fixed stream error display showing [object Object] instead of the actual error message. Errors from subscribed thread streams (e.g. context length exceeded) now properly extract the message from deserialized error objects using getErrorFromUnknown.
