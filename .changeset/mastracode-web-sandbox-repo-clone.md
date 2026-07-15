---
'mastracode-web': patch
---

Restore GitHub repo cloning inside Mastra Code Web sandboxes. The Railway sandbox template now installs `git` and `gh`, and each session reattach mints a fresh installation token and ensures the repo checkout is present before the workspace filesystem is used. Repo materialization threads GitHub metadata (repoFullName, defaultBranch, installationId) through session state and the workspace factory, and reattach is routed through the shared sandbox factory so cross-user teardown, budget accounting, and test factories all continue to work.
