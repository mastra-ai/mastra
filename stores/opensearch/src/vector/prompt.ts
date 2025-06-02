/**
 * Vector store prompt for OpenSearch. This prompt details supported filter operators, syntax, and usage examples.
 * Use this as a guide for constructing valid filters for OpenSearch vector queries in Mastra.
 */
export const OPENSEARCH_PROMPT = `When querying OpenSearch, you can ONLY use the operators listed below. Any other operators will be rejected.
Important: Do not explain how to construct the filter—use the specified operators and fields to search the content and return relevant results.
If a user tries to use an unsupported operator, reject the filter entirely and let them know that the operator is not supported.

Basic Comparison Operators:
- $eq: Exact match (default for field: value)
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
- $all: Match all values in array
  Example: { "tags": { "$all": ["premium", "sale"] } }

Logical Operators:
- $and: Logical AND (implicit when using multiple conditions)
  Example: { "$and": [{ "price": { "$gt": 100 } }, { "category": "electronics" }] }
- $or: Logical OR
  Example: { "$or": [{ "price": { "$lt": 50 } }, { "category": "books" }] }
- $not: Logical NOT
  Example: { "$not": { "category": "electronics" } }

Element Operators:
- $exists: Check if field exists
  Example: { "rating": { "$exists": true } }

Regex Operator:
- $regex: Match using a regular expression (ECMAScript syntax)
  Example: { "name": { "$regex": "^Sam.*son$" } }
  Note: Regex queries are supported for string fields only. Use valid ECMAScript patterns; invalid patterns will throw an error.

Restrictions:
- Nested fields are supported using dot notation (e.g., "address.city").
- Multiple conditions on the same field are supported (e.g., { "price": { "$gte": 100, "$lte": 1000 } }).
- Only logical operators ($and, $or, $not) can be used at the top level.
- All other operators must be used within a field condition.
  Valid: { "field": { "$gt": 100 } }
  Valid: { "$and": [...] }
  Invalid: { "$gt": 100 }
- Logical operators must contain field conditions, not direct operators.
  Valid: { "$and": [{ "field": { "$gt": 100 } }] }
  Invalid: { "$and": [{ "$gt": 100 }] }
- $not operator:
  - Must be an object
  - Cannot be empty
  - Can be used at field level or top level
  - Valid: { "$not": { "field": "value" } }
  - Valid: { "field": { "$not": { "$eq": "value" } } }
- Array operators work on array fields only.
- Empty arrays in conditions are handled gracefully.
- Regex queries are case-sensitive by default; use patterns accordingly.

Example Complex Query:
{
  "$and": [
    { "category": { "$in": ["electronics", "computers"] } },
    { "price": { "$gte": 100, "$lte": 1000 } },
    { "tags": { "$all": ["premium"] } },
    { "rating": { "$exists": true, "$gt": 4 } },
    { "$or": [
      { "stock": { "$gt": 0 } },
      { "preorder": true }
    ]},
    { "name": { "$regex": "^Sam.*son$" } }
  ]
}`;
