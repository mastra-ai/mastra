---
'@mastra/server': patch
---

Improved workspace lookup performance while keeping backwards compatibility.

The workspace handlers now use Mastra's workspace registry (`getWorkspaceById()`) for faster lookup when available, and fall back to iterating through agents for older `@mastra/core` versions.

This change is backwards compatible - newer @mastra/server works with both older and newer @mastra/core versions.
