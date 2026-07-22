---
'@mastra/memory': patch
---

Fix schema-backed Observational Memory extractors throwing a "wrong resourceId" error during observer or reflector processing when the request context carries a resource ID. Agents configured with a schema-backed `Extractor` now run extraction passes without erroring.
