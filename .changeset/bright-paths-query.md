---
'@mastra/core': minor
---

Added bounded nested scalar metadata paths to trace query predicates and discovery plans. Use dotted paths such as `metadata.retry.count` for nested keys and segment arrays such as `['metadata', 'retry.count']` only for literal dotted keys.

Metadata matching preserves scalar types and exact string values, including empty strings and whitespace, across trace, span, score, and feedback scopes. Trusted plans normalize structured paths to root-bearing segment tuples and identify the structured roots available to each predicate scope.
