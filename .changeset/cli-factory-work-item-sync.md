---
'mastra': patch
---

Added `mastra api factory work-item get`, `counts`, `sources`, `session-cards`, `activity` and `sync` commands, and filter, sort and paging input for `work-item list`.

```sh
mastra api factory work-item list <project-id> '{"stage":"review","sort":"created-newest","limit":"25"}'
mastra api factory work-item sync <project-id> '{"cursor":"<cursor>"}'
```
