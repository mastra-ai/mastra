---
'@mastra/rag': minor
---

**BREAKING CHANGES for RAG v1.0**

This release includes several breaking changes to improve API consistency and clarity:

1. **Remove deprecated `size` parameter**: The `size` parameter has been removed from chunk options. Use `maxSize` instead.
   - Before: `await doc.chunk({ size: 1000 })`
   - After: `await doc.chunk({ maxSize: 1000 })`

2. **Remove deprecated vector prompts**: Vector prompts are no longer exported from `@mastra/rag`. Import them directly from their respective store packages.
   - Before: `import { PGVECTOR_PROMPT } from '@mastra/rag'`
   - After: `import { PGVECTOR_PROMPT } from '@mastra/pg/vector/prompt'`

   Affected exports: `ASTRA_PROMPT`, `CHROMA_PROMPT`, `LIBSQL_PROMPT`, `PGVECTOR_PROMPT`, `PINECONE_PROMPT`, `QDRANT_PROMPT`, `UPSTASH_PROMPT`, `VECTORIZE_PROMPT`, `MONGODB_PROMPT`

3. **Rename `keepSeparator` to `separatorPosition`**: Eliminated boolean overloading for clearer API semantics.
   - Before: `keepSeparator: false | true | 'start' | 'end'`
   - After: `separatorPosition: 'start' | 'end'` (omit for removal)

   Migration:
   - `keepSeparator: false` → Don't pass `separatorPosition`
   - `keepSeparator: true` → `separatorPosition: 'start'`
   - `keepSeparator: 'start'` → `separatorPosition: 'start'`
   - `keepSeparator: 'end'` → `separatorPosition: 'end'`

4. **Restructure chunk API to nested options**: Strategy-specific options are now nested under dedicated option objects for better organization and clarity.
   - Before (flat structure):
     ```typescript
     await doc.chunk({
       strategy: 'markdown',
       headers: [['#', 'title']],
       stripHeaders: true,
       maxSize: 500,
       overlap: 50,
     });
     ```
   - After (nested structure):
     ```typescript
     await doc.chunk({
       strategy: 'markdown',
       maxSize: 500,
       overlap: 50,
       markdownOptions: {
         headers: [['#', 'title']],
         stripHeaders: true,
       },
     });
     ```

**Note**: The implementation currently maintains backwards compatibility with the old flat syntax, allowing for gradual migration. The decision on whether to enforce the new syntax or permanently support both will be made based on user feedback.

**New Types Introduced:**
- `GeneralChunkOptions` - Common options for all strategies
- `CharacterStrategyOptions`, `RecursiveStrategyOptions`, `TokenStrategyOptions`, etc. - Strategy-specific options

See `RAG_V1_BREAKING_CHANGES.md` for detailed migration guide and examples for all chunking strategies.
