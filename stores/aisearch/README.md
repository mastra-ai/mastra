# @mastra/aisearch

Azure AI Search vector store provider for Mastra. This package provides vector storage and similarity search capabilities using Azure AI Search's vector search features.

## Installation

```bash
npm install @mastra/aisearch
# or
pnpm add @mastra/aisearch
# or
yarn add @mastra/aisearch
```

## Prerequisites

Before using this package, you'll need:

1. **Azure AI Search service**: Create an Azure AI Search service in your Azure subscription
2. **API Key or Azure credentials**: Get your API key from the Azure portal or use Azure authentication
3. **Service endpoint**: The URL of your Azure AI Search service (e.g., `https://your-service.search.windows.net`)

## Configuration

### Basic Setup with API Key

```typescript
import { AzureAISearchVector } from '@mastra/aisearch';

const azureVector = new AzureAISearchVector({
  id: 'azure-search-vectors',
  endpoint: 'https://your-service.search.windows.net',
  credential: 'your-api-key'
});
```

### Setup with Azure Credentials

```typescript
import { AzureAISearchVector } from '@mastra/aisearch';
import { DefaultAzureCredential } from '@azure/identity';

const azureVector = new AzureAISearchVector({
  id: 'azure-search-vectors',
  endpoint: 'https://your-service.search.windows.net',
  credential: new DefaultAzureCredential()
});
```

### Advanced Client Configuration

Use `clientOptions` to customize the SearchClient behavior with retry policies, custom headers, or proxy configurations:

```typescript
import { AzureAISearchVector } from '@mastra/aisearch';

const azureVector = new AzureAISearchVector({
  id: 'azure-search-custom',
  endpoint: 'https://your-service.search.windows.net',
  credential: 'your-api-key',
  clientOptions: {
    // Add custom policies (e.g., for proxy, logging, etc.)
    additionalPolicies: [
      {
        position: 'perCall',
        policy: {
          name: 'CustomHeadersPolicy',
          async sendRequest(request, next) {
            // Add custom headers
            request.headers.set('X-Custom-Header', 'my-value');
            return next(request);
          }
        }
      }
    ],
    // Configure retry behavior
    retryOptions: {
      maxRetries: 3,
      retryDelayInMs: 1000
    }
  }
});
```

#### Example: Using with a Proxy

```typescript
import { AzureAISearchVector } from '@mastra/aisearch';
import type { PipelinePolicy } from '@azure/core-rest-pipeline';

// Custom proxy policy
const createProxyPolicy = (config: {
  proxyUrl: string;
  token: string;
}): PipelinePolicy => ({
  name: 'ProxyPolicy',
  async sendRequest(request, next) {
    // Rewrite URL to proxy
    const originalUrl = new URL(request.url);
    request.url = `${config.proxyUrl}${originalUrl.pathname}${originalUrl.search}`;
    
    // Add proxy authentication
    request.headers.set('Authorization', `Bearer ${config.token}`);
    
    return next(request);
  }
});

const azureVector = new AzureAISearchVector({
  id: 'azure-search-proxy',
  endpoint: 'https://your-service.search.windows.net',
  credential: 'dummy-key', // Not used with proxy
  clientOptions: {
    additionalPolicies: [{
      position: 'perCall',
      policy: createProxyPolicy({
        proxyUrl: 'https://my-proxy.example.com',
        token: process.env.PROXY_TOKEN!
      })
    }]
  }
});
```

### Integration with Mastra Memory System

```typescript
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { AzureAISearchVector } from '@mastra/aisearch';

// Setup Azure AI Search vector store
const azureVector = new AzureAISearchVector({
  id: 'azure-memory-store',
  endpoint: process.env.AZURE_AI_SEARCH_ENDPOINT!,
  credential: process.env.AZURE_AI_SEARCH_CREDENTIAL!,
});

// Configure Memory with Azure AI Search
const memory = new Memory({
  vector: azureVector,
  options: {
    lastMessages: 15,
    semanticRecall: {
      topK: 5,
      messageRange: 3,
    },
  },
  embedder: openai.embedding('text-embedding-3-small'),
});

// Create agent with advanced memory
const agent = new Agent({
  id: 'azure-assistant',
  name: 'Azure-Powered Assistant',
  instructions: 'You are an assistant with advanced memory capabilities powered by Azure AI Search.',
  model: openai('gpt-4o'),
  memory,
});
```

### Basic Vector Store Setup

```typescript
import { Mastra } from '@mastra/core';
import { AzureAISearchVector } from '@mastra/aisearch';

const azureVector = new AzureAISearchVector({
  id: 'azure-search',
  endpoint: process.env.AZURE_AI_SEARCH_ENDPOINT!,
  credential: process.env.AZURE_AI_SEARCH_CREDENTIAL!
});

const mastra = new Mastra({
  vectors: {
    'azure-search': azureVector
  }
});
```

## Usage Examples

### Creating an Index

```typescript
// Create a new vector index
await azureVector.createIndex({
  indexName: 'products',
  dimension: 1536, // Vector dimension (e.g., for OpenAI embeddings)
  metric: 'cosine' // Similarity metric: 'cosine', 'euclidean', or 'dotproduct'
});
```

### Inserting Vectors

```typescript
// Insert vectors with metadata
const vectorIds = await azureVector.upsert({
  indexName: 'products',
  vectors: [
    [0.1, 0.2, 0.3, ...], // Vector 1 (1536 dimensions)
    [0.4, 0.5, 0.6, ...], // Vector 2 (1536 dimensions)
  ],
  metadata: [
    { 
      category: 'electronics', 
      brand: 'Apple', 
      price: 999,
      content: 'iPhone 15 Pro Max with advanced camera system'
    },
    { 
      category: 'electronics', 
      brand: 'Samsung', 
      price: 899,
      content: 'Galaxy S24 Ultra with S Pen and AI features'
    }
  ],
  ids: ['iphone-15-pro', 'galaxy-s24-ultra'] // Optional: provide custom IDs
});

console.log('Inserted vector IDs:', vectorIds);
```

### Searching Vectors

#### Basic Vector Search

```typescript
const results = await azureVector.query({
  indexName: 'products',
  queryVector: [0.1, 0.2, 0.3, ...], // Query vector (1536 dimensions)
  topK: 5, // Return top 5 similar results
  includeVector: false // Set to true if you want the vectors in results
});

console.log('Search results:', results);
// Output: [{ id: 'iphone-15-pro', score: 0.95, metadata: {...}, document: '...' }, ...]
```

#### Filtered Vector Search

```typescript
// Using structured filter syntax
const results = await azureVector.query({
  indexName: 'products',
  queryVector: [0.1, 0.2, 0.3, ...],
  topK: 10,
  filter: {
    and: [
      { eq: { category: 'electronics' } },
      { gt: { price: 500 } },
      { contains: { content: 'camera' } }
    ]
  }
});
```

#### Advanced Filtering Examples

```typescript
// Complex filter with OR conditions
const complexFilter = {
  and: [
    {
      or: [
        { eq: { brand: 'Apple' } },
        { eq: { brand: 'Samsung' } }
      ]
    },
    { 
      and: [
        { ge: { price: 500 } },
        { le: { price: 1500 } }
      ]
    },
    {
      not: {
        contains: { content: 'refurbished' }
      }
    }
  ]
};

const results = await azureVector.query({
  indexName: 'products',
  queryVector: queryEmbedding,
  filter: complexFilter,
  topK: 20
});
```

#### Using Raw OData Filters

```typescript
// Using raw OData filter syntax for advanced scenarios
const results = await azureVector.query({
  indexName: 'products',
  queryVector: queryEmbedding,
  filter: {
    $filter: "category eq 'electronics' and price lt 1000 and search.ismatch('smartphone', 'content')"
  },
  topK: 5
});
```

## Advanced Features

Azure AI Search for Mastra includes advanced capabilities that make it the most comprehensive vector store compared to other providers.

### Semantic Search

Significantly improves result relevance using advanced language models:

```typescript
// Basic semantic search
const results = await azureVector.query({
  indexName: 'my-index',
  queryVector: [0.1, 0.2, ...],
  topK: 10,
  useSemanticSearch: true,
  semanticOptions: {
    configurationName: 'my-config',
    semanticQuery: 'What is artificial intelligence?',
    answers: true,
    captions: true,
    maxWaitTime: 5000
  }
});
```

### Multi-Vector Hybrid Search

Combines multiple vectors with different weights for more sophisticated searches:

```typescript
// Multi-vector search with text vectorization
const results = await azureVector.query({
  indexName: 'my-index',
  queryVector: manualVector,
  topK: 10,
  textVectorization: {
    text: 'machine learning algorithms',
    fields: ['content_vector', 'title_vector']
  }
});
```

### Advanced Vector Search Options

```typescript
const results = await azureVector.query({
  indexName: 'my-index',
  queryVector: [0.1, 0.2, ...],
  topK: 10,
  exhaustiveSearch: true,    // Exact k-NN search for precision
  weight: 2.0,              // Relative weight in hybrid searches
  oversampling: 3,          // Only with compressed vectors
  queryType: 'full',        // 'simple' | 'full' | 'semantic'
  filterMode: 'preFilter'   // 'preFilter' | 'postFilter'
});
```

### Document Search with Automatic Answers

```typescript
const results = await azureVector.query({
  indexName: 'knowledge-base',
  queryVector: await embed('What are the benefits of AI?'),
  topK: 5,
  useSemanticSearch: true,
  semanticOptions: {
    configurationName: 'default',
    answers: true,    // Extract direct answers
    captions: true    // Generate passage summaries
  }
});

// Results will include:
// - result.metadata['@search.captions']: Automatic summaries
// - result.metadata['@search.rerankerScore']: Semantic score
```

## Flexible Schema Support

Azure AI Search supports completely flexible schemas with customizable vector fields and advanced configurations.

### Advanced Index Creation

```typescript
// Create index with custom vector field and additional fields
await azureVector.createIndex({
  indexName: 'my-flexible-index',
  dimension: 512,
  vectorField: 'custom_embedding', // Custom vector field name
  additionalFields: [
    {
      name: 'title',
      type: 'Edm.String',
      searchable: true,
      filterable: true
    },
    {
      name: 'tags',
      type: 'Collection(Edm.String)',
      searchable: true,
      filterable: true,
      facetable: true
    }
  ],
  hnswParameters: {
    m: 16,              // Connections per layer
    efConstruction: 800, // Construction time accuracy
    efSearch: 500       // Query time accuracy
  },
  semanticConfig: {
    name: 'semantic-config',
    prioritizedFields: {
      titleField: 'title',
      contentFields: ['content'],
      keywordsFields: ['tags']
    }
  }
});
```

### Dynamic Vector Field Detection

The implementation automatically detects vector fields in existing indexes:

```typescript
// Works with any existing index regardless of vector field name
const results = await azureVector.query({
  indexName: 'legacy-index', // May use 'vector', 'embedding', etc.
  queryVector: [0.1, 0.2, ...],
  topK: 5
});
// Automatically detects and uses the correct vector field
```

### Feature Comparison

| Feature | Pinecone | Qdrant | **Azure AI Search** |
|---------|----------|--------|-------------------|
| Basic search | ✅ | ✅ | ✅ |
| Complex filters | ✅ | ✅ | ✅ |
| Hybrid search | ✅ (sparse) | ✅ (sparse) | ✅ (multi-vector + text) |
| **Semantic search** | ❌ | ❌ | ✅ |
| **Automatic vectorization** | ❌ | ❌ | ✅ |
| **Exhaustive search** | ❌ | ❌ | ✅ |
| **Custom vector fields** | ❌ | ❌ | ✅ |
| **Flexible schema** | ❌ | ❌ | ✅ |
| **HNSW parameter control** | ❌ | Limited | ✅ Complete |

### Updating Vectors

```typescript
// Update vector and/or metadata
await azureVector.updateVector({
  indexName: 'products',
  id: 'iphone-15-pro',
  update: {
    vector: [0.2, 0.3, 0.4, ...], // New vector
    metadata: { 
      category: 'electronics',
      brand: 'Apple',
      price: 899, // Updated price
      content: 'iPhone 15 Pro Max - Now with better price!'
    }
  }
});
```

### Managing Indexes

```typescript
// List all indexes
const indexes = await azureVector.listIndexes();
console.log('Available indexes:', indexes);

// Get index information
const indexInfo = await azureVector.describeIndex({ indexName: 'products' });
console.log('Index stats:', indexInfo);
// Output: { dimension: 1536, count: 1000, metric: 'cosine' }

// Delete an index
await azureVector.deleteIndex({ indexName: 'products' });
```

### Deleting Vectors

```typescript
// Delete specific vector
await azureVector.deleteVector({
  indexName: 'products',
  id: 'iphone-15-pro'
});
```

## Filter Syntax

Azure AI Search uses OData syntax for filtering. This package supports both structured filter objects and raw OData strings.

### Structured Filter Syntax

| Operation | Description | Example |
|-----------|-------------|---------|
| `eq` | Equals | `{ eq: { category: 'electronics' } }` |
| `ne` | Not equals | `{ ne: { status: 'discontinued' } }` |
| `gt` | Greater than | `{ gt: { price: 100 } }` |
| `ge` | Greater than or equal | `{ ge: { rating: 4.0 } }` |
| `lt` | Less than | `{ lt: { price: 1000 } }` |
| `le` | Less than or equal | `{ le: { discount: 50 } }` |
| `contains` | String contains | `{ contains: { description: 'wireless' } }` |
| `startsWith` | String starts with | `{ startsWith: { name: 'iPhone' } }` |
| `endsWith` | String ends with | `{ endsWith: { model: 'Pro' } }` |
| `and` | Logical AND | `{ and: [filter1, filter2] }` |
| `or` | Logical OR | `{ or: [filter1, filter2] }` |
| `not` | Logical NOT | `{ not: filter }` |

### Raw OData Filter

For advanced scenarios, you can use raw OData syntax:

```typescript
const filter = {
  $filter: "category eq 'electronics' and price lt 1000 and geo.distance(location, geography'POINT(-122.131577 47.678581)') le 10"
};
```

## Error Handling

The package uses Mastra's error handling system. All errors are wrapped in `MastraError` objects with appropriate categorization:

```typescript
import { MastraError } from '@mastra/core/error';

try {
  await azureVector.createIndex({
    indexName: 'test',
    dimension: 1536,
    metric: 'cosine'
  });
} catch (error) {
  if (error instanceof MastraError) {
    console.error('Mastra Error:', error.id);
    console.error('Details:', error.details);
  }
}
```

## Supported Metrics

- **cosine**: Cosine similarity (default, recommended for most use cases)
- **euclidean**: Euclidean distance
- **dotproduct**: Dot product similarity

## Limitations and Considerations

### Azure AI Search Limitations

- **Maximum vector dimensions**: 3072 per field
- **Maximum document size**: 16 MB
- **Query limits**: Rate limits apply based on your pricing tier
- **Index limits**: Number of indexes varies by pricing tier

### Performance Considerations

- **Batch operations**: Use batch upsert for better performance when inserting multiple vectors
- **Index warming**: First queries might be slower on cold indexes
- **Field selection**: Only select necessary fields in queries to improve performance
- **Filter optimization**: Structure filters for optimal performance (equality filters first)

### Best Practices

1. **Index naming**: Use descriptive names following Azure naming conventions
2. **Metadata design**: Keep metadata flat when possible for better filtering performance
3. **Vector dimensions**: Ensure all vectors have the same dimension within an index
4. **Connection pooling**: Reuse the same AzureAISearchVector instance across your application
5. **Error handling**: Always wrap operations in try-catch blocks

## Environment Variables

For production use, store sensitive configuration in environment variables:

```bash
# .env file
AZURE_SEARCH_ENDPOINT=https://your-service.search.windows.net
AZURE_SEARCH_API_KEY=your-api-key
```

```typescript
// Configuration
const azureVector = new AzureAISearchVector({
  id: 'azure-search',
  endpoint: process.env.AZURE_SEARCH_ENDPOINT!,
  credential: process.env.AZURE_SEARCH_API_KEY!
});
```

## TypeScript Support

This package is fully typed and provides excellent TypeScript support:

```typescript
import type { 
  AzureAISearchVector, 
  AzureAISearchVectorFilter,
  AzureAISearchVectorOptions 
} from '@mastra/aisearch';

// Type-safe filter construction
const filter: AzureAISearchVectorFilter = {
  and: [
    { eq: { category: 'electronics' } },
    { gt: { price: 100 } }
  ]
};
```

## Testing

This package includes comprehensive tests for Azure AI Search integration with Mastra Memory.

### Test Types

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests (requires Azure credentials)
npm run test:integration

# Memory-specific tests
npm run test:memory
npm run test:memory:integration

# Quick connection test
npm run test:quick

# Memory integration scenarios
npm run test:memory:scenario
npm run test:memory:real
```

### Memory Integration Testing

The package includes specialized tests for Memory integration:

1. **Unit Tests** (`src/vector/memory.test.ts`): Mock-based tests for Memory compatibility
2. **Scenario Tests** (`examples/memory-test-scenario.ts`): Functional tests with realistic memory operations
3. **Real Integration** (`examples/real-memory-integration.ts`): Full integration with @mastra/memory (if available)

#### Running Memory Tests

```bash
# Test memory interface compatibility
npm run test:memory

# Test with realistic scenarios (requires Azure credentials)
npm run test:memory:scenario

# Test with real Mastra Memory integration (requires Azure + OpenAI credentials)
npm run test:memory:real
```

#### Memory Test Environment

For memory integration tests, set these environment variables:

```bash
# Required for all memory tests
AZURE_AI_SEARCH_ENDPOINT=https://your-service.search.windows.net
AZURE_AI_SEARCH_CREDENTIAL=your-admin-api-key

# Required for real memory integration tests
OPENAI_API_KEY=your-openai-api-key
```

## Contributing

This package is part of the Mastra framework. For contributions:

1. Follow the [Mastra contribution guidelines](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md)
2. Ensure all tests pass: `pnpm test`
3. Add tests for new functionality, especially memory-related features
4. Test memory integration with: `npm run test:memory:scenario`
5. Update documentation as needed

## License

Apache-2.0 - See the [LICENSE](https://github.com/mastra-ai/mastra/blob/main/LICENSE.md) file for details.

## Support

- **Documentation**: [Mastra Docs](https://mastra.ai/docs)
- **Discord**: [Mastra Community](https://discord.gg/BTYqqHKUrf)
- **GitHub Issues**: [Report bugs or request features](https://github.com/mastra-ai/mastra/issues)
