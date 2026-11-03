---
'mastra': minor
---

Added `mastra api factory skills` to list Factory skills, plus `mastra api factory skill update` and `mastra api factory skill revert` to save or remove a Factory project's edit to a skill. Only organization admins can edit skills.

```sh
mastra api factory skills '{"projectId":"<project-id>"}'
mastra api factory skill update <project-id> factory-plan '{"content":"---\nname: factory-plan\ndescription: Our planning rules\n---\n\n# Plan\n"}'
mastra api factory skill revert <project-id> factory-plan
```
