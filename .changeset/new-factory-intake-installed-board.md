---
'mastra': patch
---

Fixed New Factory creation with a Linear or Jira project on deployments that don't install the built-in Work board. The project's issues now go to an installed board instead of failing with `Board 'work' is not installed`.
