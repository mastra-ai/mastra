---
'@mastra/memory': major
'@mastra/server': major
'@mastra/core': major
---

This simplifies the Memory API by removing the confusing rememberMessages method and renaming query to recall for better clarity.

The rememberMessages method name implied it might persist data when it was actually just retrieving messages, same as query. Having two methods that did essentially the same thing was unnecessary.

Before:

```typescript
// Two methods that did the same thing
memory.rememberMessages({ threadId, resourceId, config, vectorMessageSearch });
memory.query({ threadId, resourceId, perPage, vectorSearchString });
```

After:

```typescript
// Single unified method with clear purpose
memory.recall({ threadId, resourceId, perPage, vectorMessageSearch, threadConfig });
```

All usages have been updated across the codebase including tests. The agent now calls recall directly with the appropriate parameters.
