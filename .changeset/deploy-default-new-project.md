---
'mastra': patch
---

`mastra deploy`, `mastra studio deploy`, and `mastra server deploy` now preselect "Create new project" in the project picker when no existing project matches your project name. Before, the picker preselected the first existing project, so pressing Enter on a new project deployed over an unrelated one. If exactly one existing project matches by name or slug, it is still preselected.
