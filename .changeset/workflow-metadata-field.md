---
"@mastra/core": patch
"@mastra/server": patch
"@mastra/client-js": patch
---

Workflows now support an optional `metadata` field for attaching custom key-value data such as `displayName`, `author`, or `category`. Metadata is preserved through serialization and returned in workflow info API responses.

```typescript
// Define a workflow with metadata
const myWorkflow = createWorkflow({
  id: 'data-processing',
  metadata: {
    displayName: 'Data Processing Pipeline',
    author: 'team@example.com',
    category: 'ETL',
  },
  inputSchema: z.object({ ... }),
  outputSchema: z.object({ ... }),
});

// Retrieve workflow info with metadata via the Mastra Server API
const workflowInfo = await mastraClient.getWorkflow('data-processing');
console.log(workflowInfo.metadata?.displayName); // "Data Processing Pipeline"
```
