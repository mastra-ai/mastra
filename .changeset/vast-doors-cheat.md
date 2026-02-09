---
'@mastra/azure': minor
---

Added a new `@mastra/azure` vector store package for Azure AI Search.

- Supports index creation, updates, deletes, and similarity search operations.
- Supports filtering in vector queries for more precise retrieval.

**Why:** This adds an official Azure AI Search vector adapter so teams using Azure can integrate with Mastra's vector-store APIs without custom adapters.

**Usage**

```ts
import { AzureAISearchVector } from '@mastra/azure';

const vectorStore = new AzureAISearchVector({
  endpoint: process.env.AZURE_AISEARCH_ENDPOINT!,
  credential: process.env.AZURE_AISEARCH_API_KEY!,
  id: 'azure-search-vectors',
});
```
