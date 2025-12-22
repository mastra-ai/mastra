---
"@mastra/memory": patch
---

Fix giant debug log messages (30-40kb) when using agents with memory and debug logging enabled.

**Problem**: The memory recall debug log was including the entire threadConfig object, which could contain large zod schemas (30-40kb when serialized).

**Solution**: Replace the full threadConfig log with selective configuration properties:
- `threadId`: Basic identifier for the operation
- `perPage`: Pagination setting  
- `page`: Current page
- `orderBy`: Sort configuration
- `hasWorkingMemorySchema`: Boolean indicator if schema exists (without the schema itself)
- `workingMemoryEnabled`: Working memory enabled status
- `semanticRecallEnabled`: Semantic recall enabled status

This maintains useful debugging information while eliminating the giant log messages containing serialized schemas.
