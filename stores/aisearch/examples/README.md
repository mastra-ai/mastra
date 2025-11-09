# Azure AI Search Examples

This directory contains examples demonstrating how to use the Azure AI Search vector store with Mastra.

## Prerequisites

1. **Azure AI Search Service**: Create an Azure AI Search service in your Azure subscription
2. **API Key**: Get your API key from the Azure portal
3. **Environment Variables**: Set up the following environment variables:
   ```bash
   export AZURE_SEARCH_ENDPOINT="https://your-service.search.windows.net"
   export AZURE_SEARCH_API_KEY="your-api-key"
   ```

## Examples

### 1. Complete Demo (`complete-demo.ts`)

A comprehensive example that demonstrates all major features of the Azure AI Search vector store:

- ✅ Index creation and management
- ✅ Vector upsert with rich metadata
- ✅ Similarity search
- ✅ Complex filtering (equality, comparison, text search)
- ✅ Logical operators (AND, OR, NOT)
- ✅ Vector and metadata updates
- ✅ Vector deletion
- ✅ Performance testing with concurrent queries
- ✅ Error handling and cleanup

**To run:**
```bash
# Set environment variables first
export AZURE_SEARCH_ENDPOINT="https://your-service.search.windows.net"
export AZURE_SEARCH_API_KEY="your-api-key"

# Run the demo
cd stores/aisearch
pnpm ts-node examples/complete-demo.ts
```

**What it demonstrates:**
- Creates a product catalog with realistic data
- Shows how to generate and use vector embeddings
- Demonstrates various query patterns and filters
- Includes performance benchmarking
- Handles cleanup and error scenarios

### 2. Integration Tests (`../src/vector/index.integration.test.ts`)

Real integration tests that work with a live Azure AI Search service:

**To run:**
```bash
# Set environment variables
export RUN_INTEGRATION_TESTS=true
export AZURE_SEARCH_ENDPOINT="https://your-service.search.windows.net"
export AZURE_SEARCH_API_KEY="your-api-key"

# Run integration tests
cd stores/aisearch
pnpm test src/vector/index.integration.test.ts
```

**What it tests:**
- Real Azure AI Search operations
- Index lifecycle management
- Vector operations with actual API calls
- Error handling with live service
- Performance characteristics

## Sample Use Cases

### E-commerce Product Search

```typescript
import { AzureAISearchVector } from '@mastra/aisearch';

const productStore = new AzureAISearchVector({
  id: 'product-search',
  endpoint: process.env.AZURE_SEARCH_ENDPOINT!,
  credential: process.env.AZURE_SEARCH_API_KEY!,
});

// Create product index
await productStore.createIndex({
  indexName: 'products',
  dimension: 384, // For sentence-transformers/all-MiniLM-L6-v2
  metric: 'cosine',
});

// Add products
const productIds = await productStore.upsert({
  indexName: 'products',
  vectors: productEmbeddings,
  metadata: productMetadata,
});

// Search with filters
const results = await productStore.query({
  indexName: 'products',
  queryVector: searchEmbedding,
  topK: 10,
  filter: {
    and: [
      { eq: { category: 'electronics' } },
      { lt: { price: 1000 } },
      { eq: { inStock: true } }
    ]
  }
});
```

### Document Search with RAG

```typescript
import { AzureAISearchVector } from '@mastra/aisearch';

const documentStore = new AzureAISearchVector({
  id: 'document-search',
  endpoint: process.env.AZURE_SEARCH_ENDPOINT!,
  credential: process.env.AZURE_SEARCH_API_KEY!,
});

// Create document index
await documentStore.createIndex({
  indexName: 'documents',
  dimension: 1536, // For OpenAI text-embedding-ada-002
  metric: 'cosine',
});

// Add document chunks
await documentStore.upsert({
  indexName: 'documents',
  vectors: chunkEmbeddings,
  metadata: chunkMetadata.map(chunk => ({
    title: chunk.title,
    content: chunk.content,
    source: chunk.source,
    page: chunk.page,
    lastModified: chunk.lastModified,
  })),
});

// Semantic search
const relevantChunks = await documentStore.query({
  indexName: 'documents',
  queryVector: questionEmbedding,
  topK: 5,
  filter: {
    and: [
      { contains: { source: 'manual' } },
      { ge: { lastModified: '2024-01-01' } }
    ]
  }
});
```

### Multi-tenant Vector Search

```typescript
import { AzureAISearchVector } from '@mastra/aisearch';

const multiTenantStore = new AzureAISearchVector({
  id: 'multi-tenant',
  endpoint: process.env.AZURE_SEARCH_ENDPOINT!,
  credential: process.env.AZURE_SEARCH_API_KEY!,
});

// Create tenant-specific index
await multiTenantStore.createIndex({
  indexName: `tenant-${tenantId}-vectors`,
  dimension: 768,
  metric: 'cosine',
});

// Query with tenant isolation
const results = await multiTenantStore.query({
  indexName: `tenant-${tenantId}-vectors`,
  queryVector: queryEmbedding,
  topK: 20,
  filter: {
    and: [
      { eq: { tenantId: tenantId } },
      { eq: { status: 'active' } }
    ]
  }
});
```

## Configuration Examples

### Using Azure Credentials (Recommended for Production)

```typescript
import { DefaultAzureCredential } from '@azure/identity';
import { AzureAISearchVector } from '@mastra/aisearch';

const azureVector = new AzureAISearchVector({
  id: 'secure-search',
  endpoint: 'https://your-service.search.windows.net',
  credential: new DefaultAzureCredential(),
});
```

### Using with Mastra Framework

```typescript
import { Mastra } from '@mastra/core';
import { AzureAISearchVector } from '@mastra/aisearch';

const azureVector = new AzureAISearchVector({
  id: 'main-vector-store',
  endpoint: process.env.AZURE_SEARCH_ENDPOINT!,
  credential: process.env.AZURE_SEARCH_API_KEY!,
});

const mastra = new Mastra({
  vectors: {
    'azure-search': azureVector
  }
});

// Use through Mastra
const vectorStore = mastra.getVectorStore('azure-search');
```

## Performance Tips

1. **Batch Operations**: Use batch upsert for better performance
2. **Dimension Selection**: Choose appropriate vector dimensions for your use case
3. **Index Design**: Structure metadata for optimal filtering
4. **Connection Reuse**: Reuse the same AzureAISearchVector instance
5. **Async Operations**: Leverage concurrent queries for better throughput

## Troubleshooting

### Common Issues

1. **"Index already exists" Error**: This is normal if creating an index that exists
2. **Dimension Mismatch**: Ensure all vectors have the same dimension
3. **Authentication Failures**: Verify your endpoint URL and API key
4. **Rate Limiting**: Azure AI Search has rate limits based on your pricing tier
5. **Slow Queries**: Cold indexes might have slower first queries

### Debug Tips

```typescript
// Enable detailed logging
const azureVector = new AzureAISearchVector({
  id: 'debug-search',
  endpoint: process.env.AZURE_SEARCH_ENDPOINT!,
  credential: process.env.AZURE_SEARCH_API_KEY!,
});

// Check index stats
const stats = await azureVector.describeIndex({ indexName: 'your-index' });
console.log('Index stats:', stats);

// List all indexes
const indexes = await azureVector.listIndexes();
console.log('Available indexes:', indexes);
```

## Next Steps

- Explore the [main README](../README.md) for complete API documentation
- Check out [Mastra's documentation](https://mastra.ai/docs) for framework integration
- See the [Azure AI Search documentation](https://docs.microsoft.com/en-us/azure/search/) for service details