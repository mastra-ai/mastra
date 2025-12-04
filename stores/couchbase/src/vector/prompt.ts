/**
 * Vector store specific prompt that details supported operators and examples.
 * This prompt helps users construct valid filters for the Couchbase Search Service.
 */
export const COUCHBASE_SEARCH_STORE_PROMPT = `When querying Couchbase Search Service, you can ONLY use the operators listed below. Any other operators will be rejected.
Important: All filter fields MUST be prefixed with 'metadata.'. For example, to filter on a 'category' field, you must use 'metadata.category'.
Important: Don't explain how to construct the filter - use the specified operators and fields to search the content and return relevant results.
If a user tries to give an explicit operator that is not supported, reject the filter entirely and let them know that the operator is not supported.

Basic Comparison Operators:
- $eq: Exact match
  Example: { "metadata.category": { "$eq": "electronics" } }
- $ne: Not equal
  Example: { "metadata.category": { "$ne": "electronics" } }

Numeric and Date Comparison Operators:
- $gt: Greater than
  Example: { "metadata.price": { "$gt": 100 } }
- $gte: Greater than or equal
  Example: { "metadata.price": { "$gte": 100 } }
- $lt: Less than
  Example: { "metadata.price": { "$lt": 100 } }
- $lte: Less than or equal
  Example: { "metadata.price": { "$lte": 100 } }
  Example (Date): { "metadata.timestamp": { "$gt": "2024-01-01T00:00:00.000Z" } }

Logical Operators:
- $and: Logical AND
  Example: { "$and": [{ "metadata.price": { "$gt": 100 } }, { "metadata.category": "electronics" }] }
- $or: Logical OR
  Example: { "$or": [{ "metadata.price": { "$lt": 50 } }, { "metadata.category": "books" }] }
- $not: Logical NOT
  Example: { "$not": { "metadata.category": "electronics" } }
- $nor: Logical NOR
  Example: { "$nor": [{ "metadata.price": { "$lt": 50 } }, { "metadata.category": "books" }] }


Restrictions:
- Array operators like '$in' and '$nin' are not supported.
- Regex patterns are not supported.
- Element operators are not supported.
- All filter fields MUST be prefixed with 'metadata.'.
- Nested fields within the metadata object are supported using dot notation (e.g., 'metadata.details.author').
- Multiple conditions on the same field are supported with an explicit $and.
- If multiple top-level fields exist, they're implicitly wrapped in an $and.
- Only logical operators ($and, $or, $not, $nor) can be used at the top level.
- All other operators must be used within a field condition.
  Valid: { "metadata.field": { "$gt": 100 } }
  Valid: { "$and": [...] }
  Invalid: { "$gt": 100 }
- Logical operators must contain field conditions, not direct operators.
  Valid: { "$and": [{ "metadata.field": { "$gt": 100 } }] }
  Invalid: { "$and": [{ "$gt": 100 }] }
- Logical operators ($and, $or, $not, $nor):
  - Can only be used at top level or nested within other logical operators.
  - Cannot be used on a field level, or be nested inside a field.
  - Valid: { "$and": [{ "metadata.field": { "$gt": 100 } }] }
  - Valid: { "$or": [{ "$and": [{ "metadata.field": { "$gt": 100 } }] }] }
  - Invalid: { "metadata.field": { "$and": [{ "$gt": 100 }] } }

Additional Notes:
- The 'includeVector' query parameter is not supported and will result in an error if used.

Example Complex Query:
{
  "$and": [
    { "metadata.category": "electronics" },
    { "metadata.price": { "$gte": 100, "$lte": 1000 } },
    { "$or": [
      { "metadata.inStock": true },
      { "metadata.preorder": true }
    ]}
  ]
}`;

/**
 * Vector store specific prompt that details supported operators and examples.
 * This prompt helps users construct valid filters for the Couchbase Query Service.
 */
export const COUCHBASE_QUERY_STORE_PROMPT = `When querying Couchbase Query Service, you can ONLY use the operators listed below. Any other operators will be rejected.
Important: All filter fields MUST be prefixed with 'metadata.'. For example, to filter on a 'category' field, you must use 'metadata.category'.
Important: Don't explain how to construct the filter - use the specified operators and fields to search the content and return relevant results.
If a user tries to give an explicit operator that is not supported, reject the filter entirely and let them know that the operator is not supported.

Basic Comparison Operators:
- $eq: Exact match
  Example: { "metadata.category": { "$eq": "electronics" } }
- $ne: Not equal
  Example: { "metadata.category": { "$ne": "electronics" } }

Numeric and Date Comparison Operators:
- $gt: Greater than
  Example: { "metadata.price": { "$gt": 100 } }
- $gte: Greater than or equal
  Example: { "metadata.price": { "$gte": 100 } }
- $lt: Less than
  Example: { "metadata.price": { "$lt": 100 } }
- $lte: Less than or equal
  Example: { "metadata.price": { "$lte": 100 } }
  Example (Date): { "metadata.timestamp": { "$gt": "2024-01-01T00:00:00.000Z" } }

Logical Operators:
- $and: Logical AND
  Example: { "$and": [{ "metadata.price": { "$gt": 100 } }, { "metadata.category": "electronics" }] }
- $or: Logical OR
  Example: { "$or": [{ "metadata.price": { "$lt": 50 } }, { "metadata.category": "books" }] }
- $not: Logical NOT
  Example: { "$not": { "metadata.category": "electronics" } }
- $nor: Logical NOR
  Example: { "$nor": [{ "metadata.price": { "$lt": 50 } }, { "metadata.category": "books" }] }


Restrictions:
- Array operators like '$in' and '$nin' are not supported.
- Regex patterns are not supported.
- Element operators are not supported.
- All filter fields MUST be prefixed with 'metadata.'.
- Nested fields within the metadata object are supported using dot notation (e.g., 'metadata.details.author').
- Multiple conditions on the same field are supported with an explicit $and.
- If multiple top-level fields exist, they're implicitly wrapped in an $and.
- Only logical operators ($and, $or, $not, $nor) can be used at the top level.
- All other operators must be used within a field condition.
  Valid: { "metadata.field": { "$gt": 100 } }
  Valid: { "$and": [...] }
  Invalid: { "$gt": 100 }
- Logical operators must contain field conditions, not direct operators.
  Valid: { "$and": [{ "metadata.field": { "$gt": 100 } }] }
  Invalid: { "$and": [{ "$gt": 100 }] }
- Logical operators ($and, $or, $not, $nor):
  - Can only be used at top level or nested within other logical operators.
  - Cannot be used on a field level, or be nested inside a field.
  - Valid: { "$and": [{ "metadata.field": { "$gt": 100 } }] }
  - Valid: { "$or": [{ "$and": [{ "metadata.field": { "$gt": 100 } }] }] }
  - Invalid: { "metadata.field": { "$and": [{ "$gt": 100 }] } }

Additional Notes:
- The 'includeVector' query parameter is supported and can be set to 'true' to include the vector in the query results.

Example Complex Query:
{
  "$and": [
    { "metadata.category": "electronics" },
    { "metadata.price": { "$gte": 100, "$lte": 1000 } },
    { "$or": [
      { "metadata.inStock": true },
      { "metadata.preorder": true }
    ]}
  ]
}`;
