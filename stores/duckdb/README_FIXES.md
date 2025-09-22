# DuckDB Vector Store - Fixes Needed

## Type Mismatches Found

### 1. CreateIndexParams
- Core expects: `indexName`, `dimension`, `metric`
- We have: `name`, `dimension`, `metric`

### 2. UpsertVectorParams
- Core expects: `vectors: number[][]`, `metadata?: Record<string, any>[]`, `ids?: string[]`
- We have: `vectors: Array<{id, values, metadata}>`

### 3. UpdateVectorParams
- Core expects: `id: string`, `update: {vector?, metadata?}`
- We have: `id, values, metadata, sparseValues`

### 4. QueryVectorParams
- Core expects: `includeVector?: boolean` (not `includeVectors`)
- Core doesn't have: `includeMetadata`, `namespace`

### 5. DuckDB Database constructor
- Need to use simple constructor: `new Database(path)`
- Set options separately if needed

## Solution Plan

1. Update the implementation to match core types exactly
2. Add adapter methods for the enhanced functionality
3. Fix the DuckDB constructor usage
4. Remove unsupported fields from type definitions