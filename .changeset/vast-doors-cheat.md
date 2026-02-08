---
'@mastra/azure': minor
---

Added a new `@mastra/azure` vector store package for Azure AI Search.

- Supports index creation, updates, deletes, and similarity search operations.
- Adds filtering support and integration tests for real Azure AI Search behavior.

**Usage**

```ts
import { AzureAISearchVector } from '@mastra/azure';

const vectorStore = new AzureAISearchVector({
  endpoint: process.env.AZURE_AISEARCH_ENDPOINT!,
  credential: process.env.AZURE_AISEARCH_API_KEY!,
  id: 'azure-search-vectors',
});
```
