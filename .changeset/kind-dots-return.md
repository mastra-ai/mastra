---
'@mastra/deployer': patch
---

Browser streaming now works for stored agents. The deployer's `getToolset` first checks the runtime agent registry, then falls back to the editor's stored-agent lookup, so agents created at runtime through the editor can stream browser sessions without being pre-registered in code.
