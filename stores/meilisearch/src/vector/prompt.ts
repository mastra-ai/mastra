/**
 * Vector store specific prompt that details supported operators and examples.
 * This prompt helps users construct valid filters for Meilisearch Vector.
 */
export const MEILISEARCH_PROMPT = `When querying Meilisearch, you can ONLY use the operators listed below. Any other operators will be rejected.
Important: Don't explain how to construct the filter - use the specified operators and fields to search the content and return relevant results.
If a user tries to give an explicit operator that is not supported, reject the filter entirely and let them know that the operator is not supported.

Basic Comparison Operators:
- $eq: Exact match (default when using field: value)
  Example: { "category": "electronics" }
- $ne: Not equal
  Example: { "category": { "$ne": "electronics" } }
- $gt: Greater than (numeric fields)
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
- $all: Match values that contain all elements (array membership)
  Example: { "tags": { "$all": ["premium", "sale"] } }

Logical Operators:
- $and: Logical AND (can be implicit or explicit)
  Implicit Example: { "price": { "$gt": 100 }, "category": "electronics" }
  Explicit Example: { "$and": [{ "price": { "$gt": 100 } }, { "category": "electronics" }] }
- $or: Logical OR
  Example: { "$or": [{ "price": { "$lt": 50 } }, { "category": "books" }] }
- $not: Logical NOT
  Example: { "$not": { "category": "electronics" } }
- $nor: Logical NOR (none of the conditions match)
  Example: { "$nor": [{ "category": "electronics" }, { "category": "books" }] }

Element Operators:
- $exists: Check if field exists
  Example: { "rating": { "$exists": true } }

Null Handling:
- Match null values with $eq/$ne: null
  Example: { "deletedAt": { "$eq": null } }

Restrictions:
- Regex patterns ($regex/$options) are NOT supported by Meilisearch.
- Substring matching ($contains) and per-element array matching ($elemMatch) are NOT supported.
- Array length filtering ($size) is NOT supported.
- All similarity is cosine-based; euclidean/dotproduct metrics are not honoured.
- Only $and, $or, $not, and $nor logical operators are supported at the top level.
- Empty arrays in $in will return no results; empty $nin matches all.
- Nested fields are supported using dot notation.
- Multiple conditions on the same field are supported with both implicit and explicit $and.
- At least one key-value pair is required in filter object.
- Empty objects and undefined values are treated as no filter.
- Invalid types in comparison operators will throw errors.
- All non-logical operators must be used within a field condition.
  Valid: { "field": { "$gt": 100 } }
  Valid: { "$and": [...] }
  Invalid: { "$gt": 100 }
- Logical operators must contain field conditions, not direct operators.
  Valid: { "$and": [{ "field": { "$gt": 100 } }] }
  Invalid: { "$and": [{ "$gt": 100 }] }
- The fields you filter on must be present in document metadata; new metadata
  keys become filterable automatically the first time they are upserted.

Example Complex Query:
{
  "$and": [
    { "category": { "$in": ["electronics", "computers"] } },
    { "price": { "$gte": 100, "$lte": 1000 } },
    { "rating": { "$exists": true, "$gt": 4 } },
    { "$or": [
      { "stock": { "$gt": 0 } },
      { "preorder": { "$eq": true } }
    ]},
    { "$not": { "status": "discontinued" } }
  ]
}`;
