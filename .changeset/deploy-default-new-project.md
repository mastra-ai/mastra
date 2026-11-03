---
'mastra': patch
---

`mastra deploy`, `mastra studio deploy`, and `mastra server deploy` now preselect "Create new project" in the project picker unless exactly one existing project matches your project name or slug. Before, the picker preselected the first existing project, so pressing Enter on a new project deployed over an unrelated one. When exactly one project matches, that project is still preselected.
