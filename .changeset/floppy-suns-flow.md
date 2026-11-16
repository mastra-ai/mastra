---
'@mastra/factory': patch
'mastra': patch
---

Added `mastra api factory intake dry-run` and `mastra api factory intake test` to check a Factory project's intake rules against real items without filing anything.

```sh
mastra api factory intake dry-run <project-id> '{"order":["docs","work"]}'
mastra api factory intake test <project-id> '{"url":"https://github.com/acme/app/issues/12"}'
```
