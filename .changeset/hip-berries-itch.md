---
'@mastra/server': patch
---

Improved workspace lookup performance with backwards compatibility.

The workspace handlers now use Mastra's direct workspace registry lookup (`getWorkspaceById()`) for O(1) performance when available. Falls back to iterating through agents for compatibility with older @mastra/core versions that don't have the registry methods.

This change is backwards compatible - newer @mastra/server works with both older and newer @mastra/core versions.
