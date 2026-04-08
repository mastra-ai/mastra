---
'@mastra/inngest': patch
---

Add `entityName` to workflow span creation in the Inngest workflow engine, parallel to the core fix in #14949. Without this, workflows created via `init(inngest).createWorkflow({...})` show up as "unknown" in the metrics dashboard's workflow trace volume tab even when they have an explicit `id`.
