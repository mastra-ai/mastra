# @mastra/vector-vectorize

Vector store implementation for Vectorize, a managed vector database service optimized for AI applications.

## Installation

```bash
npm install @mastra/vector-vectorize
```

## Usage

```typescript
import { VectorizeStore } from '@mastra/vector-vectorize';

const vectorStore = new VectorizeStore({
  // configuration options
});
```

## Configuration

The Vectorize vector store requires the following configuration:

- `VECTORIZE_API_KEY`: Your Vectorize API key
- `VECTORIZE_INDEX_NAME`: Name of the index to use
- `VECTORIZE_PROJECT_ID`: Your Vectorize project ID

## Features

- Purpose-built for AI and ML workloads
- High-performance vector similarity search
- Automatic index optimization
- Scalable architecture
- Real-time updates and queries

## Related Links

- [Vectorize Documentation](https://www.vectorize.com/docs)
