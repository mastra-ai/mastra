---
'@mastra/core': patch
---

Tool input validation errors now include the path of each invalid field. Previously, MCP 1.x servers returned errors like `Invalid input: expected array, received string` with no indication of which argument was wrong. Errors now read, for example:

```
- items.0.tags: Invalid input: expected array, received string
- options.destination: Invalid input: expected string, received undefined
```

Fixes #25766.
