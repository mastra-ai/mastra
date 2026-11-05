---
'@mastra/code-sdk': patch
---

Faster Factory project listing in the TUI. `listFactoryProjects` reads the repositories from the project list when the server returns them, which takes one request instead of one per project. Older servers still work: their repositories are read per project as before.
