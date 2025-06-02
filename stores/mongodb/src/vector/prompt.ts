/**
 * Vector store specific prompt that details supported operators and examples.
 * This prompt helps users construct valid filters for MongoDB Vector.
 */
export const MONGODB_PROMPT = `When querying MongoDB Vector, you can ONLY use the operators listed below. Any other operators will be rejected.
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
- $size: Match arrays with specific length
  Example: { "tags": { "$size": 3 } }

Logical Operators:
- $and: Logical AND (can be implicit or explicit)
  Implicit Example: { "price": { "$gt": 100 }, "category": "electronics" }
  Explicit Example: { "$and": [{ "price": { "$gt": 100 } }, { "category": "electronics" }] }
- $or: Logical OR
  Example: { "$or": [{ "price": { "$lt": 50 } }, { "category": "books" }] }
- $not: Logical NOT
  Example: { "$not": { "category": "electronics" } }
- $nor: Logical NOR
  Example: { "$nor": [{ "price": { "$lt": 50 } }, { "category": "books" }] }

Element Operators:
- $exists: Check if field exists
  Example: { "rating": { "$exists": true } }
- $type: Check field type
  Example: { "price": { "$type": "number" } }

Text Search Operators:
- $text: Full text search
  Example: { "$text": { "$search": "gaming laptop" } }
- $regex: Regular expression match
  Example: { "name": { "$regex": "^Gaming" } }

Restrictions:
- Only logical operators ($and, $or, $not, $nor) can be used at the top level
- Empty arrays in array operators will return no results
- Nested fields are supported using dot notation
- Multiple conditions on the same field are supported
- At least one key-value pair is required in filter object
- Empty objects and undefined values are treated as no filter
- Invalid types in comparison operators will throw errors
- All non-logical operators must be used within a field condition
  Valid: { "field": { "$gt": 100 } }
  Valid: { "$and": [...] }
  Invalid: { "$gt": 100 }
- Logical operators must contain field conditions, not direct operators
  Valid: { "$and": [{ "field": { "$gt": 100 } }] }
  Invalid: { "$and": [{ "$gt": 100 }] }
- Logical operators ($and, $or, $not, $nor):
  - Can only be used at top level or nested within other logical operators
  - Can not be used on a field level, or be nested inside a field
  - Can not be used inside an operator
  - Valid: { "$and": [{ "field": { "$gt": 100 } }] }
  - Valid: { "$or": [{ "$and": [{ "field": { "$gt": 100 } }] }] }
  - Invalid: { "field": { "$and": [{ "$gt": 100 }] } }
  - Invalid: { "field": { "$or": [{ "$gt": 100 }] } }
  - Invalid: { "field": { "$gt": { "$and": [{...}] } } }

Example Complex Query:
{
  "$and": [
    { "category": { "$in": ["electronics", "computers"] } },
    { "price": { "$gte": 100, "$lte": 1000 } },
    { "tags": { "$all": ["premium", "sale"] } },
    { "items": { "$elemMatch": { "price": { "$gt": 50 }, "inStock": true } } },
    { "$text": { "$search": "gaming laptop" } },
    { "$or": [
      { "stock": { "$gt": 0 } },
      { "preorder": true }
    ]},
    { "$not": { "status": "discontinued" } }
  ]
}`;
