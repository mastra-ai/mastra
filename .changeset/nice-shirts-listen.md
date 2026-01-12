---
'@mastra/qdrant': minor
---

Added support for creating payload (metadata) indexes in Qdrant

Qdrant Cloud and deployments with `strict_mode_config = true` require explicit payload indexes for metadata filtering. This release adds two new methods to `QdrantVector`:

**New exports:**

- `PayloadSchemaType` - Union type for Qdrant payload schema types ('keyword', 'integer', 'float', 'geo', 'text', 'bool', 'datetime', 'uuid')
- `CreatePayloadIndexParams` - Parameters interface for creating payload indexes
- `DeletePayloadIndexParams` - Parameters interface for deleting payload indexes

**New methods:**

- `createPayloadIndex()` - Creates a payload index on a collection field for efficient filtering
- `deletePayloadIndex()` - Removes a payload index from a collection field

**Example usage:**

import { QdrantVector } from '@mastra/qdrant';

const qdrant = new QdrantVector({ url: 'http://localhost:6333', id: 'my-store' });

// Create a keyword index for filtering by source
await qdrant.createPayloadIndex({
indexName: 'my-collection',
fieldName: 'source',
fieldSchema: 'keyword',
});

// Now filtering works in strict mode environments
const results = await qdrant.query({
indexName: 'my-collection',
queryVector: embeddings,
filter: { source: 'document-a' },
});

Closes #8923
