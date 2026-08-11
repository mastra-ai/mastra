/**
 * Vector store specific prompt that details supported Oracle JSON metadata filter operators and examples.
 * This prompt helps users construct valid filters for Oracle Database Vector Search.
 */
export const ORACLEDB_PROMPT = `When querying Oracle Database Vector Search, you can ONLY use the operators listed below. Any other operators will be rejected.
Important: Don't explain how to construct the filter - use the specified operators and fields to search the content and return relevant results.
If a user tries to give an explicit operator that is not supported, reject the filter entirely and let them know that the operator is not supported.

Oracle-specific behavior:
- Metadata is stored as Oracle JSON.
- Scalar comparisons are compiled to JSON_VALUE(metadata, ...).
- Array, existence, and element-match checks are compiled to JSON_EXISTS(metadata, ...).
- Regex filters are compiled to Oracle REGEXP_LIKE.
- String contains filters are compiled to case-insensitive LIKE predicates.
- User metadata values are always bound as parameters; do not generate raw SQL fragments inside filters.

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
- $in: Match any value in an array or scalar field
  Example: { "category": { "$in": ["electronics", "books"] } }
- $nin: Does not match any value in an array or scalar field
  Example: { "category": { "$nin": ["electronics", "books"] } }
- $all: Match all values in an array field
  Example: { "tags": { "$all": ["premium", "sale"] } }
- $elemMatch: Match array elements that meet all specified conditions
  Example: { "items": { "$elemMatch": { "price": { "$gt": 100 } } } }
- $contains: For strings, perform case-insensitive substring matching. For arrays, require contained values.
  Example: { "title": { "$contains": "oracle" } }
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

Element Operators:
- $exists: Check if a JSON metadata field exists
  Example: { "rating": { "$exists": true } }

Special Operators:
- $size: Array length check
  Example: { "tags": { "$size": 2 } }
- $regex: Oracle regular expression match using REGEXP_LIKE
  Example: { "source": { "$regex": "oracle.*database" } }

Restrictions:
- Nested fields are supported using dot notation
- Multiple conditions on the same field are supported with both implicit and explicit $and
- Array operations should be used only on JSON array fields
- Empty arrays in $in, $nin, and $all conditions are handled gracefully
- Only logical operators ($and, $or, $not, $nor) can be used at the top level
- All other operators must be used within a field condition
  Valid: { "field": { "$gt": 100 } }
  Valid: { "$and": [{ "field": { "$gt": 100 } }] }
  Invalid: { "$gt": 100 }
  Invalid: { "$contains": "value" }
- Logical operators must contain field conditions, not direct operators
  Valid: { "$and": [{ "field": { "$gt": 100 } }] }
  Invalid: { "$and": [{ "$gt": 100 }] }
- $not operator:
  - Must be a non-empty object
  - Can be used at field level or top level
  - Valid: { "$not": { "field": "value" } }
  - Valid: { "field": { "$not": { "$eq": "value" } } }
- Other logical operators ($and, $or, $nor):
  - Can only be used at top level or nested within other logical operators
  - Can not be used on a field level, or be nested inside a field
  - Can not be used inside an operator
  - Valid: { "$and": [{ "field": { "$gt": 100 } }] }
  - Valid: { "$or": [{ "$and": [{ "field": { "$gt": 100 } }] }] }
  - Invalid: { "field": { "$and": [{ "$gt": 100 }] } }
  - Invalid: { "field": { "$or": [{ "$gt": 100 }] } }
  - Invalid: { "field": { "$gt": { "$and": [{...}] } } }
- $elemMatch requires an object with conditions
  Valid: { "array": { "$elemMatch": { "field": "value" } } }
  Invalid: { "array": { "$elemMatch": "value" } }

Example Complex Query:
{
  "$and": [
    { "resource_id": "docs" },
    { "thread_id": { "$exists": true } },
    { "score": { "$gte": 0.75 } },
    { "tags": { "$all": ["oracle", "mastra"] } },
    { "chunks": { "$elemMatch": { "page": { "$gte": 2 }, "kind": "reference" } } },
    { "$or": [
      { "source": { "$regex": "oracle.*database" } },
      { "title": { "$contains": "vector search" } }
    ]}
  ]
}`;
