/**
 * Vector store specific prompts that detail supported operators and examples.
 * These prompts help users construct valid filters for each vector store.
 */

export const UPSTASH_PROMPT = `When querying Upstash Vector, you can ONLY use the operators listed below. Any other operators will be rejected.
Important: Don't just explain how to construct the filter - use the specified operators and fields to search the content and return relevant results.

Basic Comparison Operators:
- $eq: Exact match (default when using field: value)
  Example: { "category": "electronics" } or { "category": { "$eq": "electronics" } }
- $ne: Not equal
  Example: { "category": { "$ne": "electronics" } }
- $gt: Greater than
  Example: { "price": { "$gt": 100 } }
- $gte: Greater than or equal
  Example: { "price": { "$gte": 100 } }
- $lt: Less than
  Example: { "price": { "$lt": 100 } }
- $lte: Less than or equal
  Example: { "price": { "$lte": 100 } }

Array Operators:
- $in: Match any value in array
  Example: { "category": { "$in": ["electronics", "books"] } }
- $nin: Does not match any value in array
  Example: { "category": { "$nin": ["electronics", "books"] } }
- $all: Matches all values in array
  Example: { "tags": { "$all": ["premium", "new"] } }
- $contains: Check if array contains value
  Example: { "tags": { "$contains": "premium" } }

Logical Operators:
- $and: Logical AND (implicit when using multiple conditions)
  Example: { "$and": [{ "price": { "$gt": 100 } }, { "category": "electronics" }] }
- $or: Logical OR
  Example: { "$or": [{ "price": { "$lt": 50 } }, { "category": "books" }] }
- $not: Logical NOT
  Example: { "$not": { "category": "electronics" } }
- $nor: Logical NOR
  Example: { "$nor": [{ "price": { "$lt": 50 } }, { "category": "books" }] }

Other Operators:
- $regex: Pattern matching using glob syntax (only as operator, not direct RegExp)
  Example: { "name": { "$regex": "iphone*" } }  // Correct
  Example: { "name": /iphone.*/ }               // Not supported
- $exists: Check if field exists
  Example: { "rating": { "$exists": true } }

Restrictions:
- Null/undefined values are not supported in any operator
- Empty arrays are supported only for $in/$nin operators
- Multiple conditions on the same field are combined with AND
- Nested fields are supported using dot notation
- Direct RegExp patterns are not supported, use $regex operator instead
- String values with quotes will be properly escaped
- Only logical operators ($and, $or, $not, $nor) can be used at the top level
- All other operators must be used within a field condition
  Valid: { "field": { "$gt": 100 } }
  Valid: { "$and": [...] }
  Invalid: { "$gt": 100 }
  Invalid: { "$regex": "pattern" }

Example Complex Query:
{
  "$and": [
    { "category": { "$in": ["electronics", "computers"] } },
    { "price": { "$gt": 100, "$lt": 1000 } },
    { "tags": { "$all": ["premium", "new"] } },
    { "name": { "$regex": "iphone*" } },
    { "$or": [
      { "brand": "Apple" },
      { "rating": { "$gte": 4.5 } }
    ]}
  ]
}`;

export const PINECONE_PROMPT = `When querying Pinecone, you can ONLY use the operators listed below. Any other operators will be rejected.
Important: Don't just explain how to construct the filter - use the specified operators and fields to search the content and return relevant results.

Basic Comparison Operators:
- $eq: Exact match (default when using field: value)
  Example: { "category": "electronics" }
- $ne: Not equal
  Example: { "category": { "$ne": "electronics" } }
- $gt: Greater than
  Example: { "price": { "$gt": 100 } }
- $gte: Greater than or equal
  Example: { "price": { "$gte": 100 } }
- $lt: Less than
  Example: { "price": { "$lt": 100 } }
- $lte: Less than or equal
  Example: { "price": { "$lte": 100 } }

Array Operators:
- $in: Match any value in array
  Example: { "category": { "$in": ["electronics", "books"] } }
- $nin: Does not match any value in array
  Example: { "category": { "$nin": ["electronics", "books"] } }
- $all: Matches all values in array (simulated using $and)
  Example: { "tags": { "$all": ["premium", "new"] } }

Logical Operators:
- $and: Logical AND (can be implicit or explicit)
  Implicit Example: { "price": { "$gt": 100 }, "category": "electronics" }
  Explicit Example: { "$and": [{ "price": { "$gt": 100 } }, { "category": "electronics" }] }
- $or: Logical OR
  Example: { "$or": [{ "price": { "$lt": 50 } }, { "category": "books" }] }

Other Operators:
- $exists: Check if field exists
  Example: { "rating": { "$exists": true } }

Restrictions:
- Regex patterns are not supported
- Only $and and $or logical operators are supported
- Empty arrays in $in/$nin will return no results
- A non-empty array is required for $all operator
- Nested fields are supported using dot notation
- Multiple conditions on the same field are supported with both implicit and explicit $and
- At least one key-value pair is required in filter object
- Empty objects and undefined values are treated as no filter (returns all results)
- Invalid types in comparison operators will throw errors
- Only logical operators ($and, $or) can be used at the top level
- All other operators must be used within a field condition
  Valid: { "field": { "$gt": 100 } }
  Valid: { "$and": [...] }
  Invalid: { "$gt": 100 }
  Invalid: { "$exists": true }

Example Complex Query:
{
  "$and": [
    { "category": { "$in": ["electronics", "computers"] } },
    { "price": { "$gte": 100, "$lte": 1000 } },
    { "tags": { "$all": ["premium"] } },
    { "$or": [
      { "inStock": true },
      { "preorder": true }
    ]}
  ]
}`;

export const QDRANT_PROMPT = `When querying Qdrant, you can ONLY use the operators listed below. Any other operators will be rejected.
Important: Don't just explain how to construct the filter - use the specified operators and fields to search the content and return relevant results.

Basic Comparison Operators:
- $eq: Exact match (default when using field: value)
  Example: { "category": "electronics" }
- $ne: Not equal
  Example: { "category": { "$ne": "electronics" } }
- $gt: Greater than
  Example: { "price": { "$gt": 100 } }
- $gte: Greater than or equal
  Example: { "price": { "$gte": 100 } }
- $lt: Less than
  Example: { "price": { "$lt": 100 } }
- $lte: Less than or equal
  Example: { "price": { "$lte": 100 } }

Array Operators:
- $in: Match any value in array
  Example: { "category": { "$in": ["electronics", "books"] } }
- $nin: Does not match any value in array
  Example: { "category": { "$nin": ["electronics", "books"] } }

Logical Operators:
- $and: Logical AND (implicit when using multiple conditions)
  Example: { "$and": [{ "price": { "$gt": 100 } }, { "category": "electronics" }] }
- $or: Logical OR
  Example: { "$or": [{ "price": { "$lt": 50 } }, { "category": "books" }] }
- $not: Logical NOT
  Example: { "$not": { "category": "electronics" } }

Special Operators:
- $regex: Pattern matching (standard regex syntax)
  Example: { "name": { "$regex": "iphone.*" } }
- $count: Array length/value count
  Example: { "tags": { "$count": { "$gt": 2 } } }
- $geo: Geographical filters
  Example: {
    "location": {
      "$geo": {
        "type": "radius",
        "center": { "lat": 52.5, "lon": 13.4 },
        "radius": 10000
      }
    }
  }
- $hasId: Filter by document IDs
  Example: { "$hasId": ["doc1", "doc2"] }
- $hasVector: Check vector existence
  Example: { "$hasVector": true }
- $datetime: RFC 3339 datetime range
  Example: {
    "created_at": {
      "$datetime": {
        "range": {
          "gt": "2024-01-01T00:00:00Z",
          "lt": "2024-12-31T23:59:59Z"
        }
      }
    }
  }
- $null: Check for null values
  Example: { "field": { "$null": true } }
- $empty: Check for empty values
  Example: { "array": { "$empty": true } }

Restrictions:
- Direct RegExp patterns are not supported, use $regex operator
- Nested fields are supported using dot notation
- Geo filtering requires specific format for radius, box, or polygon
- Datetime values must be in RFC 3339 format
- Array operations support nested field queries
- Empty arrays in conditions are handled gracefully
- Multiple conditions on same field use implicit AND
- Only logical operators ($and, $or, $not) and special operators ($hasId, $hasVector) can be used at the top level
- All other operators must be used within a field condition
  Valid: { "field": { "$gt": 100 } }
  Valid: { "$and": [...] }
  Valid: { "$hasId": [...] }
  Invalid: { "$gt": 100 }
  Invalid: { "$regex": "pattern" }

Example Complex Query:
{
  "$and": [
    { "category": { "$in": ["electronics"] } },
    { "price": { "$gt": 100 } },
    { "location": {
      "$geo": {
        "type": "radius",
        "center": { "lat": 52.5, "lon": 13.4 },
        "radius": 5000
      }
    }},
    { "$or": [
      { "stock": { "$gt": 0 } },
      { "preorder": true }
    ]}
  ]
}`;

export const CHROMA_PROMPT = `When querying Chroma, you can ONLY use the operators listed below. Any other operators will be rejected.
Important: Don't just explain how to construct the filter - use the specified operators and fields to search the content and return relevant results.

Basic Comparison Operators:
- $eq: Exact match (default when using field: value)
  Example: { "category": "electronics" }
- $ne: Not equal
  Example: { "category": { "$ne": "electronics" } }
- $gt: Greater than
  Example: { "price": { "$gt": 100 } }
- $gte: Greater than or equal
  Example: { "price": { "$gte": 100 } }
- $lt: Less than
  Example: { "price": { "$lt": 100 } }
- $lte: Less than or equal
  Example: { "price": { "$lte": 100 } }

Array Operators:
- $in: Match any value in array
  Example: { "category": { "$in": ["electronics", "books"] } }
- $nin: Does not match any value in array
  Example: { "category": { "$nin": ["electronics", "books"] } }

Logical Operators:
- $and: Logical AND (implicit when using multiple conditions)
  Example: { "$and": [{ "price": { "$gt": 100 } }, { "category": "electronics" }] }
- $or: Logical OR
  Example: { "$or": [{ "price": { "$lt": 50 } }, { "category": "books" }] }

Restrictions:
- Regex patterns are not supported
- Element operators are not supported
- Only $and and $or logical operators are supported
- Nested fields are supported using dot notation
- Multiple conditions on the same field must use $and
- Empty arrays in $in/$nin will return no results
- If multiple top-level fields exist, they're wrapped in $and
- Only logical operators ($and, $or) can be used at the top level
- All other operators must be used within a field condition
  Valid: { "field": { "$gt": 100 } }
  Valid: { "$and": [...] }
  Invalid: { "$gt": 100 }
  Invalid: { "$in": [...] }

Example Complex Query:
{
  "$and": [
    { "category": { "$in": ["electronics", "computers"] } },
    { "price": { "$gte": 100, "$lte": 1000 } },
    { "$or": [
      { "inStock": true },
      { "preorder": true }
    ]}
  ]
}`;

export const ASTRA_PROMPT = `When querying Astra DB, you can ONLY use the operators listed below. Any other operators will be rejected.
Important: Don't just explain how to construct the filter - use the specified operators and fields to search the content and return relevant results.

Basic Comparison Operators:
- $eq: Exact match (default when using field: value)
  Example: { "category": "electronics" }
- $ne: Not equal
  Example: { "category": { "$ne": "electronics" } }
- $gt: Greater than
  Example: { "price": { "$gt": 100 } }
- $gte: Greater than or equal
  Example: { "price": { "$gte": 100 } }
- $lt: Less than
  Example: { "price": { "$lt": 100 } }
- $lte: Less than or equal
  Example: { "price": { "$lte": 100 } }

Array Operators:
- $in: Match any value in array
  Example: { "category": { "$in": ["electronics", "books"] } }
- $nin: Does not match any value in array
  Example: { "category": { "$nin": ["electronics", "books"] } }
- $all: Matches all values in array
  Example: { "tags": { "$all": ["premium", "new"] } }

Logical Operators:
- $and: Logical AND (can be implicit or explicit)
  Implicit Example: { "price": { "$gt": 100 }, "category": "electronics" }
  Explicit Example: { "$and": [{ "price": { "$gt": 100 } }, { "category": "electronics" }] }
- $or: Logical OR
  Example: { "$or": [{ "price": { "$lt": 50 } }, { "category": "books" }] }
- $not: Logical NOT
  Example: { "$not": { "category": "electronics" } }

Other Operators:
- $size: Array length check
  Example: { "tags": { "$size": 2 } }

Restrictions:
- Regex patterns are not supported
- Only $and, $or, and $not logical operators are supported
- Nested fields are supported using dot notation
- Multiple conditions on the same field are supported with both implicit and explicit $and
- Empty arrays in $in/$nin will return no results
- A non-empty array is required for $all operator
- Logical operators must contain field conditions
- $not must be an object and non-empty
- Only logical operators ($and, $or, $not) can be used at the top level
- All other operators must be used within a field condition
  Valid: { "field": { "$gt": 100 } }
  Valid: { "$and": [...] }
  Invalid: { "$gt": 100 }
  Invalid: { "$all": [...] }

Example Complex Query:
{
  "$and": [
    { "category": { "$in": ["electronics", "computers"] } },
    { "price": { "$gte": 100, "$lte": 1000 } },
    { "tags": { "$all": ["premium"] } },
    { "$or": [
      { "inStock": true },
      { "preorder": true }
    ]}
  ]
}`;

export const PGVECTOR_PROMPT = `When querying PG Vector, you can ONLY use the operators listed below. Any other operators will be rejected.
Important: Don't just explain how to construct the filter - use the specified operators and fields to search the content and return relevant results.

Basic Comparison Operators:
- $eq: Exact match (default when using field: value)
  Example: { "category": "electronics" }
- $ne: Not equal
  Example: { "category": { "$ne": "electronics" } }
- $gt: Greater than
  Example: { "price": { "$gt": 100 } }
- $gte: Greater than or equal
  Example: { "price": { "$gte": 100 } }
- $lt: Less than
  Example: { "price": { "$lt": 100 } }
- $lte: Less than or equal
  Example: { "price": { "$lte": 100 } }

Array Operators:
- $in: Match any value in array
  Example: { "category": { "$in": ["electronics", "books"] } }
- $nin: Does not match any value in array
  Example: { "category": { "$nin": ["electronics", "books"] } }
- $contains: Check if array contains value
  Example: { "tags": { "$contains": "premium" } }

Logical Operators:
- $and: Logical AND (implicit when using multiple conditions)
  Example: { "$and": [{ "price": { "$gt": 100 } }, { "category": "electronics" }] }
- $or: Logical OR
  Example: { "$or": [{ "price": { "$lt": 50 } }, { "category": "books" }] }
- $nor: Logical NOR
  Example: { "$nor": [{ "price": { "$lt": 50 } }, { "category": "books" }] }

Other Operators:
- $size: Array length check
  Example: { "tags": { "$size": 2 } }
- $regex: Pattern matching (PostgreSQL regex syntax)
  Example: { "name": { "$regex": "^iphone" } }

Restrictions:
- Direct RegExp patterns are not supported, use $regex operator
- Nested fields are supported using dot notation
- Multiple conditions on the same field are supported
- Array operations work on array fields only
- Regex patterns must follow PostgreSQL syntax
- Basic operators can handle array values as JSON strings
- Empty arrays in conditions are handled gracefully
- Only logical operators ($and, $or, $nor) can be used at the top level
- All other operators must be used within a field condition
  Valid: { "field": { "$gt": 100 } }
  Valid: { "$and": [...] }
  Invalid: { "$gt": 100 }
  Invalid: { "$regex": "pattern" }

Example Complex Query:
{
  "$and": [
    { "category": { "$in": ["electronics", "computers"] } },
    { "price": { "$gte": 100, "$lte": 1000 } },
    { "tags": { "$contains": "premium" } },
    { "$or": [
      { "name": { "$regex": "^iphone" } },
      { "description": { "$regex": ".*apple.*" } }
    ]}
  ]
}`;

export const VECTORIZE_PROMPT = `When querying Vectorize, you can ONLY use the operators listed below. Any other operators will be rejected.
Important: Don't just explain how to construct the filter - use the specified operators and fields to search the content and return relevant results.

Basic Comparison Operators:
- $eq: Exact match (default when using field: value)
  Example: { "category": "electronics" }
- $ne: Not equal
  Example: { "category": { "$ne": "electronics" } }
- $gt: Greater than
  Example: { "price": { "$gt": 100 } }
- $gte: Greater than or equal
  Example: { "price": { "$gte": 100 } }
- $lt: Less than
  Example: { "price": { "$lt": 100 } }
- $lte: Less than or equal
  Example: { "price": { "$lte": 100 } }

Array Operators:
- $in: Match any value in array
  Example: { "category": { "$in": ["electronics", "books"] } }
- $nin: Does not match any value in array
  Example: { "category": { "$nin": ["electronics", "books"] } }

Restrictions:
- Regex patterns are not supported
- Logical operators are not supported
- Fields must have a flat structure, as nested fields are not supported
- Multiple conditions on the same field are supported
- Empty arrays in $in/$nin will return no results
- Filter keys cannot be longer than 512 characters
- Filter keys cannot contain invalid characters ($, ", empty)
- Filter size is limited to prevent oversized queries
- Invalid types in operators return no results instead of throwing errors
- Empty objects are accepted in filters
- Metadata must use flat structure with dot notation (no nested objects)
- Must explicitly create metadata indexes for filterable fields (limit 10 per index)
- Can only effectively filter on indexed metadata fields
- Metadata values can be strings, numbers, booleans, or homogeneous arrays
- No operators can be used at the top level (no logical operators supported)
- All operators must be used within a field condition
  Valid: { "field": { "$gt": 100 } }
  Invalid: { "$gt": 100 }
  Invalid: { "$in": [...] }

Example Complex Query:
{
  "category": { "$in": ["electronics", "computers"] },
  "price": { "$gte": 100, "$lte": 1000 },
  "inStock": true
}`;

export const LIBSQL_PROMPT = `When querying LibSQL Vector, you can ONLY use the operators listed below. Any other operators will be rejected.
Important: Don't just explain how to construct the filter - use the specified operators and fields to search the content and return relevant results.

Basic Comparison Operators:
- $eq: Exact match (default when using field: value)
  Example: { "category": "electronics" }
- $ne: Not equal
  Example: { "category": { "$ne": "electronics" } }
- $gt: Greater than
  Example: { "price": { "$gt": 100 } }
- $gte: Greater than or equal
  Example: { "price": { "$gte": 100 } }
- $lt: Less than
  Example: { "price": { "$lt": 100 } }
- $lte: Less than or equal
  Example: { "price": { "$lte": 100 } }

Array Operators:
- $in: Match any value in array
  Example: { "category": { "$in": ["electronics", "books"] } }
- $nin: Does not match any value in array
  Example: { "category": { "$nin": ["electronics", "books"] } }
- $contains: Check if array contains value
  Example: { "tags": { "$contains": "premium" } }

Logical Operators:
- $and: Logical AND (implicit when using multiple conditions)
  Example: { "$and": [{ "price": { "$gt": 100 } }, { "category": "electronics" }] }
- $or: Logical OR
  Example: { "$or": [{ "price": { "$lt": 50 } }, { "category": "books" }] }
- $nor: Logical NOR
  Example: { "$nor": [{ "price": { "$lt": 50 } }, { "category": "books" }] }

Other Operators:
- $size: Array length check
  Example: { "tags": { "$size": 2 } }

Restrictions:
- Regex patterns are not supported
- Direct RegExp patterns will throw an error
- Nested fields are supported using dot notation
- Multiple conditions on the same field are supported
- Array operations work on array fields only
- Basic operators handle array values as JSON strings
- Empty arrays in conditions are handled gracefully
- Only logical operators ($and, $or, $nor) can be used at the top level
- All other operators must be used within a field condition
  Valid: { "field": { "$gt": 100 } }
  Valid: { "$and": [...] }
  Invalid: { "$gt": 100 }
  Invalid: { "$contains": "value" }

Example Complex Query:
{
  "$and": [
    { "category": { "$in": ["electronics", "computers"] } },
    { "price": { "$gte": 100, "$lte": 1000 } },
    { "tags": { "$contains": "premium" } },
    { "$or": [
      { "inStock": true },
      { "preorder": true }
    ]}
  ]
}`;
