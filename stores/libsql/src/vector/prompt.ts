/**
 * Vector store specific prompt that details supported operators and examples.
 * This prompt helps users construct valid filters for LibSQL Vector.
 */
export const LIBSQL_PROMPT = `When querying LibSQL Vector, you can ONLY use the operators listed below. Any other operators will be rejected.
Important: Don't explain how to construct the filter - use the specified operators and fields to search the content and return relevant results.
If a user tries to give an explicit operator that is not supported, reject the filter entirely and let them know that the operator is not supported.

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
- $all: Match all values in array
  Example: { "tags": { "$all": ["premium", "sale"] } }
- $elemMatch: Match array elements that meet all specified conditions
  Example: { "items": { "$elemMatch": { "price": { "$gt": 100 } } } }
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

Element Operators:
- $exists: Check if field exists
  Example: { "rating": { "$exists": true } }

Special Operators:
- $size: Array length check
  Example: { "tags": { "$size": 2 } }

Restrictions:
- Regex patterns are not supported
- Direct RegExp patterns will throw an error
- Nested fields are supported using dot notation
- Multiple conditions on the same field are supported with both implicit and explicit $and
- Array operations work on array fields only
- Basic operators handle array values as JSON strings
- Empty arrays in conditions are handled gracefully
- Only logical operators ($and, $or, $not, $nor) can be used at the top level
- All other operators must be used within a field condition
  Valid: { "field": { "$gt": 100 } }
  Valid: { "$and": [...] }
  Invalid: { "$gt": 100 }
  Invalid: { "$contains": "value" }
- Logical operators must contain field conditions, not direct operators
  Valid: { "$and": [{ "field": { "$gt": 100 } }] }
  Invalid: { "$and": [{ "$gt": 100 }] }
- $not operator:
  - Must be an object
  - Cannot be empty
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
    { "category": { "$in": ["electronics", "computers"] } },
    { "price": { "$gte": 100, "$lte": 1000 } },
    { "tags": { "$all": ["premium", "sale"] } },
    { "items": { "$elemMatch": { "price": { "$gt": 50 }, "inStock": true } } },
    { "$or": [
      { "stock": { "$gt": 0 } },
      { "preorder": true }
    ]}
  ]
}`;
