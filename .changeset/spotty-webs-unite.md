---
'mastra': patch
---

Added `mastra api factory session rows` and `mastra api factory session activity`, which read a Factory project's sessions as the sidebar lists them, and which of them are running or waiting on a person.

```bash
mastra api factory session rows <project-id> '{"owner":"mine","groupBy":"board","window":["board:work:25"]}'
mastra api factory session activity <project-id>
```
