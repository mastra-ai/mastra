---
'@mastra/rag': minor
---

Added Amazon Bedrock Knowledge Base tool (`createBedrockKBTool`) to @mastra/rag. Enables document retrieval from Bedrock Managed Knowledge Bases with agentic retrieval and automatic fallback.

```typescript
import { createBedrockKBTool } from '@mastra/rag';

const tool = createBedrockKBTool({
  knowledgeBaseId: 'YOUR_KB_ID',
  region: 'us-west-2',
});

const results = await tool.execute('What is RAG?');
```
