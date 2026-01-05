---
'@mastra/playground-ui': patch
'@mastra/server': patch
---

Fix workflow observability view broken by invalid entityType parameter

The UI workflow observability view was failing with a Zod validation error when trying to filter traces by workflow. The UI was sending `entityType=workflow`, but the backend's `EntityType` enum only accepts `workflow_run`.

**Root Cause**: The legacy value transformation was happening in the handler (after validation), but Zod validation occurred earlier in the request pipeline, rejecting the request before it could be transformed.

**Solution**: 
- Added `z.preprocess()` to the query schema to transform `workflow` → `workflow_run` before validation
- Kept handler transformation for defense in depth
- Updated UI to use `EntityType.WORKFLOW_RUN` enum value for type safety

This maintains backward compatibility with legacy clients while fixing the validation error.

Fixes #11412
