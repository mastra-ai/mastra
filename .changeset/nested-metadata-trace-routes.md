---
'@mastra/server': minor
---

Added nested string, number, and boolean metadata paths to the trace query HTTP contract. Requests accept canonical dot paths and exact segment arrays for literal dotted keys, while field and value discovery responses preserve typed scalar values.

```json
{
  "op": "eq",
  "left": { "path": "metadata.customer.id" },
  "right": { "literal": "123a" }
}
```

**Breaking change**

Metadata predicates now compare stored strings exactly. Empty and whitespace-only strings are present values, and discovery can return number and boolean values instead of coercing every value to a string.
