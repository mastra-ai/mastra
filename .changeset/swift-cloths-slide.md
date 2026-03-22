---
'@mastra/core': patch
---

Agents now return control to the caller after invoking client-only tools, preventing repeated model calls. Previously, tools without a server-side execute function caused the agent loop to continue indefinitely. Fixes #14093
