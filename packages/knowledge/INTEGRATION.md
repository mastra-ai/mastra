# Knowledge Package Integration Guide

This guide shows how to integrate the `@mastra/knowledge` package into your Mastra project for document storage and search.

## Installation

```bash
pnpm add @mastra/knowledge
```

## Basic Setup

### 1. Create a Knowledge Instance

```typescript
import { Knowledge } from '@mastra/knowledge';
import { openai } from '@ai-sdk/openai';

// BM25-only (no vector database needed)
const knowledge = new Knowledge({
  provider: 'PINECONE', // or any vector provider
  bm25: true, // Enable BM25 keyword search
});

// With vector search (requires embeddings)
const knowledgeWithVectors = new Knowledge({
  provider: 'PINECONE',
  apiKey: process.env.PINECONE_API_KEY,
  indexName: 'my-knowledge-index',
  model: openai.embedding('text-embedding-3-small'),
  bm25: true, // Enable hybrid search
});
```

### 2. Add Documents

```typescript
// Add a single document
await knowledge.add({
  id: 'doc-1',
  content: 'Mastra is an open-source framework for building AI applications.',
  metadata: { source: 'docs', category: 'overview' },
});

// Add multiple documents
await knowledge.addMany([
  { id: 'doc-2', content: 'Agents can use tools to interact with external systems.' },
  { id: 'doc-3', content: 'Workflows allow you to orchestrate complex AI pipelines.' },
]);
```

### 3. Search

```typescript
// BM25 keyword search (fast, no embeddings needed)
const bm25Results = await knowledge.search('AI framework', {
  mode: 'bm25',
  topK: 5,
});

// Vector semantic search (requires embeddings)
const vectorResults = await knowledge.search('how to build agents', {
  mode: 'vector',
  topK: 5,
});

// Hybrid search (combines both for best results)
const hybridResults = await knowledge.search('workflow orchestration', {
  mode: 'hybrid',
  topK: 5,
  hybrid: { vectorWeight: 0.7 }, // 70% vector, 30% BM25
});

// Results include score details
console.log(hybridResults[0]);
// {
//   id: 'doc-3',
//   content: 'Workflows allow you to orchestrate complex AI pipelines.',
//   score: 0.85,
//   scoreDetails: { vector: 0.9, bm25: 0.75 }
// }
```

## Using with Agents

### RetrievedKnowledge Processor

The `RetrievedKnowledge` processor automatically retrieves relevant documents based on the user's query:

```typescript
import { Agent } from '@mastra/core/agent';
import { Knowledge, RetrievedKnowledge } from '@mastra/knowledge';
import { openai } from '@ai-sdk/openai';

const knowledge = new Knowledge({
  provider: 'PINECONE',
  bm25: true,
});

// Add your documents
await knowledge.addMany([
  { id: 'faq-1', content: 'To reset your password, go to Settings > Security > Reset Password.' },
  { id: 'faq-2', content: 'Our support hours are Monday-Friday, 9am-5pm EST.' },
  { id: 'faq-3', content: 'Refunds are processed within 5-7 business days.' },
]);

const agent = new Agent({
  name: 'support-agent',
  model: openai('gpt-4o'),
  instructions: 'You are a helpful support agent. Answer questions based on the knowledge provided.',
  knowledge: [
    RetrievedKnowledge({
      knowledge,
      topK: 3,
      mode: 'bm25', // or 'vector' or 'hybrid'
    }),
  ],
});

// The agent will automatically search knowledge based on the user's question
const response = await agent.generate('How do I reset my password?');
```

### Static Knowledge

For fixed content that should always be included:

```typescript
import { StaticKnowledge } from '@mastra/knowledge';

const agent = new Agent({
  name: 'policy-agent',
  model: openai('gpt-4o'),
  instructions: 'You are a policy advisor.',
  knowledge: [
    StaticKnowledge({
      content: `
        Company Policies:
        - All employees must use 2FA
        - Data retention period is 7 years
        - Remote work requires VPN
      `,
    }),
    RetrievedKnowledge({
      knowledge,
      topK: 5,
    }),
  ],
});
```

## Search Modes Explained

| Mode     | Description                               | Best For                                                    |
| -------- | ----------------------------------------- | ----------------------------------------------------------- |
| `bm25`   | Keyword-based search using BM25 algorithm | Exact term matching, fast lookups, no embeddings needed     |
| `vector` | Semantic search using embeddings          | Understanding meaning, finding conceptually similar content |
| `hybrid` | Combines BM25 and vector scores           | Best of both worlds, recommended for production             |

## BM25 Configuration

Fine-tune BM25 for your use case:

```typescript
const knowledge = new Knowledge({
  provider: 'PINECONE',
  bm25: {
    k1: 1.5, // Term frequency saturation (default: 1.5)
    b: 0.75, // Length normalization (default: 0.75)
    tokenizer: {
      lowercase: true,
      removePunctuation: true,
      removeStopwords: true,
      minLength: 2,
    },
  },
});
```

## Checking Capabilities

```typescript
// Check what search modes are available
console.log(knowledge.canVectorSearch); // true if embeddings configured
console.log(knowledge.canBM25Search); // true if bm25 enabled
console.log(knowledge.canHybridSearch); // true if both available
```

## Playground UI

The Knowledge Studio UI is available in the Mastra playground. To use it:

1. Start the playground:

```bash
cd packages/playground && pnpm dev
```

2. Navigate to `/knowledge` in your browser

3. Features:
   - Create namespaces for organizing knowledge
   - Add text artifacts
   - Search with BM25/Vector/Hybrid modes
   - View and manage artifacts

## Full Example

```typescript
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Knowledge, RetrievedKnowledge, StaticKnowledge } from '@mastra/knowledge';
import { openai } from '@ai-sdk/openai';

// Create knowledge base
const knowledge = new Knowledge({
  provider: 'MEMORY', // Use in-memory for testing
  bm25: true,
});

// Populate with documents
await knowledge.addMany([
  { id: 'product-1', content: 'The Pro plan costs $99/month and includes unlimited users.' },
  { id: 'product-2', content: 'The Enterprise plan includes SSO and dedicated support.' },
  { id: 'support-1', content: 'Contact support@example.com for billing questions.' },
]);

// Create agent with knowledge
const salesAgent = new Agent({
  name: 'sales-agent',
  model: openai('gpt-4o'),
  instructions: 'You are a sales assistant. Help customers understand our products.',
  knowledge: [
    StaticKnowledge({
      content: 'Current promotion: 20% off annual plans until end of month.',
    }),
    RetrievedKnowledge({
      knowledge,
      topK: 3,
      mode: 'bm25',
    }),
  ],
});

// Register with Mastra
const mastra = new Mastra({
  agents: { salesAgent },
});

// Use the agent
const response = await mastra.getAgent('salesAgent').generate('What does the Pro plan include?');
console.log(response.text);
```

## API Reference

### Knowledge Class

```typescript
new Knowledge(config: KnowledgeConfig)
```

**Config Options:**

- `provider`: Vector store provider ('PINECONE', 'MEMORY', etc.)
- `apiKey`: API key for vector provider
- `indexName`: Index/collection name
- `model`: Embedding model from AI SDK
- `bm25`: Enable BM25 (`true` or config object)

**Methods:**

- `add(doc)`: Add a single document
- `addMany(docs)`: Add multiple documents
- `search(query, options)`: Search documents
- `delete(id)`: Delete a document

### RetrievedKnowledge

```typescript
RetrievedKnowledge({
  knowledge: Knowledge,
  topK?: number,           // Default: 5
  mode?: 'vector' | 'bm25' | 'hybrid',
  format?: 'xml' | 'markdown',
  queryExtractor?: (messages) => string,
})
```

### StaticKnowledge

```typescript
StaticKnowledge({
  content: string,
  format?: 'xml' | 'markdown',
})
```
