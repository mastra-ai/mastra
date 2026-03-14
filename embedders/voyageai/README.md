# @mastra/voyageai

VoyageAI embeddings integration for Mastra. Provides text, multimodal, and contextualized chunk embeddings using the official VoyageAI TypeScript SDK.

## Installation

```bash
npm install @mastra/voyageai
# or
pnpm add @mastra/voyageai
```

## Configuration

Set your VoyageAI API key:

```bash
export VOYAGE_API_KEY=your-api-key
```

Or pass it directly in the configuration.

## Usage

### Text Embeddings

```typescript
import { voyage, voyageEmbedding } from '@mastra/voyageai';

// Use default model (voyage-3.5)
const result = await voyage.doEmbed({ values: ['Hello world'] });
console.log(result.embeddings); // [[0.1, 0.2, ...]]

// Use specific model with options
const model = voyageEmbedding({
  model: 'voyage-3-large',
  inputType: 'query',
  outputDimension: 512,
});
const queryResult = await model.doEmbed({ values: ['search query'] });
```

### Pre-configured Models

```typescript
import { voyage } from '@mastra/voyageai';

// Voyage-4 series (highest throughput)
await voyage.v4large.doEmbed({ values: ['...'] });   // voyage-4-large (120k batch tokens)
await voyage.v4.doEmbed({ values: ['...'] });        // voyage-4 (320k batch tokens)
await voyage.v4lite.doEmbed({ values: ['...'] });    // voyage-4-lite (1M batch tokens)

// Voyage-3 series
await voyage.large.doEmbed({ values: ['...'] });     // voyage-3-large
await voyage.v35.doEmbed({ values: ['...'] });       // voyage-3.5
await voyage.v35lite.doEmbed({ values: ['...'] });   // voyage-3.5-lite
await voyage.code.doEmbed({ values: ['...'] });      // voyage-code-3
await voyage.finance.doEmbed({ values: ['...'] });   // voyage-finance-2
await voyage.law.doEmbed({ values: ['...'] });       // voyage-law-2
```

### With Mastra Memory

```typescript
import { Memory } from '@mastra/memory';
import { PgVector } from '@mastra/pg';
import { voyage } from '@mastra/voyageai';

const memory = new Memory({
  vector: new PgVector(connectionString),
  embedder: voyage,
  options: {
    semanticRecall: { topK: 5 },
  },
});
```

### With ModelRouter (String-based Selection)

```typescript
import { ModelRouterEmbeddingModel } from '@mastra/core';

// Use string format for model selection
const embedder = new ModelRouterEmbeddingModel('voyage/voyage-3.5');
const result = await embedder.doEmbed({ values: ['Hello'] });

// Works with Memory too
const memory = new Memory({
  embedder: 'voyage/voyage-3-large',
  // ...
});
```

### VoyageAI-Specific Options

```typescript
import { voyageEmbedding } from '@mastra/voyageai';

const model = voyageEmbedding({
  model: 'voyage-3.5',
  inputType: 'query',          // 'query' | 'document' for retrieval optimization
  outputDimension: 512,        // 256 | 512 | 1024 | 2048
  outputDtype: 'float',        // 'float' | 'int8' | 'uint8' | 'binary' | 'ubinary'
  truncation: true,            // Handle long inputs
});
```

### Runtime Options Override

```typescript
const result = await model.doEmbed({
  values: ['query text'],
  providerOptions: {
    voyage: {
      inputType: 'query',
      outputDimension: 256,
    },
  },
});
```

## Multimodal Embeddings

Embed interleaved text + images + video (3.5 only):

```typescript
import { voyageMultimodalEmbedding } from '@mastra/voyageai';

const multimodal = voyageMultimodalEmbedding('voyage-multimodal-3.5');

const result = await multimodal.doEmbed({
  values: [{
    content: [
      { type: 'text', text: 'A photo of a cat' },
      { type: 'image_url', image_url: 'https://example.com/cat.jpg' },
      // video_url supported on voyage-multimodal-3.5
    ]
  }]
});

// Use with vector store directly
await vectorStore.upsert({
  vectors: result.embeddings,
  metadata: [{ description: 'cat photo' }],
});
```

### Content Types

- `{ type: 'text', text: string }` - Text content
- `{ type: 'image_url', image_url: string }` - Image from URL
- `{ type: 'image_base64', image_base64: string }` - Base64-encoded image
- `{ type: 'video_url', video_url: string }` - Video from URL (3.5 only)

## Contextualized Chunk Embeddings

Embed chunks with document context to avoid "context loss":

```typescript
import { voyageContextualizedEmbedding } from '@mastra/voyageai';

const contextual = voyageContextualizedEmbedding('voyage-context-3');

// Embed document chunks (inner arrays = chunks from same document)
const result = await contextual.doEmbed({
  values: [
    ['Paragraph 1 from doc 1...', 'Paragraph 2 from doc 1...'],
    ['Content from doc 2...'],
  ],
  inputType: 'document',
});

// Returns embeddings for each chunk, preserving document context
console.log(result.embeddings.length); // 3 (2 from doc 1, 1 from doc 2)
console.log(result.chunkCounts);       // [2, 1]

// Query embedding
const queryEmbedding = await contextual.embedQuery('What was the revenue?');
```

### Helper Methods

```typescript
// Embed a query
const queryEmbedding = await contextual.embedQuery('search query');

// Embed chunks from a single document
const docEmbeddings = await contextual.embedDocumentChunks([
  'First paragraph...',
  'Second paragraph...',
]);

// Get embeddings grouped by document
const grouped = await contextual.doEmbedGrouped({
  values: [['chunk1', 'chunk2'], ['chunk3']],
  inputType: 'document',
});
console.log(grouped.embeddingsByDocument); // [[[...], [...]], [[...]]]
```

## Available Models

### Text Embedding Models

| Model | Use Case | Dimensions | Batch Tokens |
|-------|----------|------------|--------------|
| `voyage-4-large` | Best quality, highest batch capacity | 256/512/1024/2048 | 120k |
| `voyage-4` | Balanced quality/speed, high throughput | 256/512/1024/2048 | 320k |
| `voyage-4-lite` | Maximum throughput | 256/512/1024/2048 | 1M |
| `voyage-3-large` | Best quality, multilingual | 256/512/1024/2048 | 32k |
| `voyage-3.5` | Balanced quality/speed | 256/512/1024/2048 | 32k |
| `voyage-3.5-lite` | Lowest latency/cost | 256/512/1024/2048 | 32k |
| `voyage-code-3` | Code retrieval | 256/512/1024/2048 | 32k |
| `voyage-finance-2` | Finance domain | 1024 | 32k |
| `voyage-law-2` | Legal domain | 1024 | 32k |

### Multimodal Models

| Model | Capabilities |
|-------|--------------|
| `voyage-multimodal-3` | Text + images |
| `voyage-multimodal-3.5` | Text + images + video |

### Contextualized Models

| Model | Use Case |
|-------|----------|
| `voyage-context-3` | Chunks with document context |

### Reranker Models

| Model | Context Length | Description |
|-------|----------------|-------------|
| `rerank-2.5` | 32000 | Best quality with instruction-following |
| `rerank-2.5-lite` | 32000 | Optimized for latency and quality |
| `rerank-2` | 16000 | Second-gen with multilingual support |
| `rerank-2-lite` | 8000 | Second-gen, latency-optimized |
| `rerank-1` | 8000 | First-gen, quality-focused |
| `rerank-lite-1` | 4000 | First-gen, latency-optimized |

## Reranking

VoyageAI rerankers implement the `RelevanceScoreProvider` interface for use with Mastra's reranking system.

### Basic Usage

```typescript
import { voyage, voyageReranker, createVoyageReranker } from '@mastra/voyageai';

// Use pre-configured reranker (rerank-2.5)
const reranker = voyage.reranker;

// Or create with specific model
const reranker = createVoyageReranker('rerank-2.5-lite');

// Or with full config
const reranker = createVoyageReranker({
  model: 'rerank-2.5',
  truncation: true,
});
```

### Get Relevance Score

```typescript
// Score a single document against a query
const score = await reranker.getRelevanceScore(
  'What is machine learning?',
  'Machine learning is a subset of artificial intelligence...'
);
console.log(score); // 0.85
```

### Rerank Multiple Documents

```typescript
// Rerank multiple documents efficiently in one API call
const results = await reranker.rerankDocuments(
  'What is the capital of France?',
  [
    'Paris is the capital of France.',
    'London is the capital of England.',
    'Berlin is the capital of Germany.',
  ],
  2  // topK - optional
);

// Results sorted by relevance
console.log(results);
// [
//   { document: 'Paris is the capital of France.', index: 0, score: 0.95 },
//   { document: 'Berlin is the capital of Germany.', index: 2, score: 0.32 },
// ]
```

### With Mastra RAG

```typescript
import { createVectorQueryTool } from '@mastra/rag';
import { voyage } from '@mastra/voyageai';

const tool = createVectorQueryTool({
  vectorStore,
  model: voyage,  // Embedder
  reranker: {
    model: voyage.reranker,  // VoyageAI reranker
    options: { topK: 5 },
  },
});
```

### Pre-configured Reranker Models

```typescript
import { voyage } from '@mastra/voyageai';

// Default reranker (rerank-2.5)
voyage.reranker;

// Specific models
voyage.reranker25;      // rerank-2.5
voyage.reranker25lite;  // rerank-2.5-lite
voyage.reranker2;       // rerank-2
voyage.reranker2lite;   // rerank-2-lite

// Create custom
voyage.createReranker({ model: 'rerank-1', truncation: false });
```

## AI SDK Compatibility

The package exports models compatible with both AI SDK v5 (V2) and v6 (V3):

```typescript
// V3 (default, AI SDK v6)
const v3Model = voyageEmbedding('voyage-3.5');
v3Model.specificationVersion; // 'v3'

// V2 (AI SDK v5)
const v2Model = voyageEmbeddingV2('voyage-3.5');
v2Model.specificationVersion; // 'v2'

// Pre-configured V2 models
voyage.largeV2;   // voyage-3-large with V2 interface
voyage.v35V2;     // voyage-3.5 with V2 interface
```

## API Reference

### Types

```typescript
type VoyageTextModel =
  | 'voyage-4-large'
  | 'voyage-4'
  | 'voyage-4-lite'
  | 'voyage-3-large'
  | 'voyage-3.5'
  | 'voyage-3.5-lite'
  | 'voyage-code-3'
  | 'voyage-finance-2'
  | 'voyage-law-2';

type VoyageMultimodalModel =
  | 'voyage-multimodal-3'
  | 'voyage-multimodal-3.5';

type VoyageContextModel = 'voyage-context-3';

type VoyageInputType = 'query' | 'document' | null;
type VoyageOutputDimension = 256 | 512 | 1024 | 2048;
type VoyageOutputDtype = 'float' | 'int8' | 'uint8' | 'binary' | 'ubinary';

type VoyageRerankerModel =
  | 'rerank-2.5'
  | 'rerank-2.5-lite'
  | 'rerank-2'
  | 'rerank-2-lite'
  | 'rerank-1'
  | 'rerank-lite-1';

interface VoyageRerankerConfig {
  model: VoyageRerankerModel;
  apiKey?: string;
  truncation?: boolean;
}
```

## License

Apache-2.0
