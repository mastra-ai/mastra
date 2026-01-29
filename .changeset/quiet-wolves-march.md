---
'@mastra/core': patch
---

Fixed Convex storage adapter failing with schema validation error

The workflow snapshot table schema was missing the `id` field, causing `@mastra/convex` to fail during initialization with: "the index 'by_record_id' is invalid because it references the field 'id' that does not exist."
