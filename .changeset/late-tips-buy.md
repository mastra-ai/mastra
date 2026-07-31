---
'@mastra/deployer': patch
---

Builds now record whether a file-based agent ships seed files under its `workspace/` directory, so those agents opt into the managed workspace while agents without one get no workspace.
