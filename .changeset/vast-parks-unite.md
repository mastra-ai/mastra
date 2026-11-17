---
'mastra': minor
---

Added `mastra api factory skill create` to create a skill for one Factory project. `mastra api factory skill update` now also updates a skill the project created, and `mastra api factory skill revert` deletes one. Only organization admins can create skills.

```sh
mastra api factory skill create <project-id> '{"name":"release-notes","content":"---\nname: release-notes\ndescription: Write release notes for a merged change\n---\n\n# Release notes\n"}'
```
