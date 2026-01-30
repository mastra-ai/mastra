---
'@mastra/core': patch
---

Fixed workspace initialization by automatically calling init() when resolving the workspace in agents. This ensures the workspace is properly set up before being used.
