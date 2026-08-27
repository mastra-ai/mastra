---
'@mastra/core': patch
---

Fixed a spurious "Failed to resolve versioned agent" warning when calling an agent in a project without the editor package configured. Agent calls now fall back to your code-defined agent silently; looking up a specific version ID still reports that the editor is required.
