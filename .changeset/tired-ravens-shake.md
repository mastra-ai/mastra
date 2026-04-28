---
'@mastra/core': patch
---

Fixed Linux bubblewrap failing when Workspace mounts use symlinks under LocalSandbox by resolving mount paths to real directories for isolation allowlists.
