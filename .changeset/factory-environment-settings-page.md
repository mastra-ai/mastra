---
'mastra': patch
---

Added an Environment page to Factory settings. It lists the repositories every session's sandbox starts from, in clone order: drag to reorder, switch a repository in or out, and edit its setup and teardown commands. It also edits the working directory, the workspace setup command and the sandbox provider's own settings, which are rendered from the provider's settings schema. Each field saves on its own, and clearing a field brings back the provider default.
