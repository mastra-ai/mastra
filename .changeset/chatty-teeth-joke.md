---
'@mastra/core': patch
---

Fixed JSON parsing in memory component to prevent crashes when encountering strings that start with '[' or '{' but are not valid JSON
