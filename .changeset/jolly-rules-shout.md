---
'@mastra/core': patch
---

Fixed requestContext serialization in workflow suspend/resume. The snapshot persistence used instanceof check which fails across module boundaries, causing context values to be lost on resume.
