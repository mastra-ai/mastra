---
'mastracode': patch
---

Improved the `/resource` command. Switching resources now resumes the most recent thread for that resource instead of always creating a new one. If no threads exist for the resource, a new thread is created. Also added help text clarifying how resource switching works.

Example:
```bash
/resource my-resource-id
```
