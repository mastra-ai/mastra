---
'@mastra/core': patch
---

Fixed dynamic workspace resolution to pass the full request context to workspace factories, allowing them to access session state through getState(), and handled async stream aborts correctly so initial streamed output is preserved.
