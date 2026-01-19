---
'@mastra/inngest': patch
---

Fix custom error properties being lost through Inngest serialization

Inngest's error serialization only captures standard Error properties (message, name, stack, code, cause). Custom properties like `statusCode`, `responseHeaders`, or `isRetryable` from API/AI SDK errors were being stripped during serialization. Errors are now wrapped with a cause structure that preserves custom properties through the serialization boundary.
