---
'@mastra/convex': patch
---

Fixed Convex schema validation error where `mastra_workflow_snapshots` index `by_record_id` referenced a missing `id` field. The `id` field is now explicitly defined in the Convex workflow snapshots table schema. This enables successful `npx convex dev` deployments that were previously failing with SchemaDefinitionError.
