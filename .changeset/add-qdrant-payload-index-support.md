---
'@mastra/qdrant': minor
---

Add support for creating payload (metadata) indexes in Qdrant

This release introduces a new `createPayloadIndex()` method on the `QdrantVector` class, enabling explicit creation of payload indexes for metadata fields. This feature addresses production environments (e.g., Qdrant Cloud or deployments with `strict_mode_config = true`) that require explicit payload indexes for metadata-based filtering operations.

**New exports:**
- `PayloadSchemaType` - Type representing Qdrant payload schema types ('keyword', 'integer', 'float', 'geo', 'text', 'bool', 'datetime', 'uuid')
- `createPayloadIndex(indexName, fieldName, fieldSchema)` - Method to create payload indexes with idempotent behavior on conflicts

This change aligns Mastra's abstraction with Qdrant's native client capabilities and ensures metadata filters work consistently across all Qdrant deployment environments.

**Example usage:**

```typescript
// Create a payload index for a metadata field before filtering
const qdrant = new QdrantVector(config);

// Create an index for a 'category' field (keyword type)
await qdrant.createPayloadIndex('category-idx', 'category', 'keyword');

// Now metadata-based filtering will work in strict-mode environments
const results = await qdrant.query({
  vector: [/* ... */],
  filter: { key: 'category', match: { value: 'electronics' } }
});
