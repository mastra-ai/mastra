# TODO: Apply CodeRabbit Suggestions

## Issue 1: Query method doesn't use correct distance operator for bit and sparsevec types
- **Location**: `src/vector/index.ts` - `query` method (around line 586-603)
- **Problem**: The query hardcodes `<=>` (cosine distance) operator and `1 - score` transformation regardless of the vector type
- **Fix**: Use `getDistanceOperator` method to get the correct operator and score transform

## Issue 2: Sparsevec serialization format mismatch
- **Location**: `src/vector/index.ts` - `upsert` method (around line 672-711)
- **Problem**: Validation expects `{indices, values}` objects but serialization uses `.join(',')` which assumes arrays
- **Fix**: Create proper serialization function that handles both dense and sparse vector formats

