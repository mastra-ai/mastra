---
'@mastra/playground-ui': patch
---

Consolidate Tailwind config as the single source of truth. The playground package now imports the config via a preset export instead of duplicating all theme definitions.
