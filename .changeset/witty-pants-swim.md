---
'@mastra/core': patch
---

Fixed Harness skill lookup so a workspace skill whose frontmatter name matches a code skill can still be invoked through its explicit `skills/<dir>` or `skills/<dir>/SKILL.md` path. Bare-name `session.skills.use()` calls still resolve to the code skill.
