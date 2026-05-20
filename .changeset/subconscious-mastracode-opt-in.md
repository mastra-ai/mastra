---
'mastracode': patch
'@mastra/core': patch
---

Add an experimental `/om` setting that lets MastraCode users opt in to Subconscious background psyches. When enabled, MastraCode wires Subconscious into Observational Memory and stores its durable workspace artifacts under `~/.mastracode/subconscious/<resource-id>` so the main workspace can access them.

Route Observational Memory extraction success and failure markers through the core harness so MastraCode can render TUI markers when extraction completes or fails.
