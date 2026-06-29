---
'@mastra/schema-compat': patch
---

Fixed invalid code being generated for a discriminated union when the discriminator property name contains a double quote. The property name was inserted into the `z.discriminatedUnion(...)` call without escaping, while object keys, descriptions, and defaults are serialized with `JSON.stringify`. As a result the serialized schema threw a SyntaxError when it was evaluated. The discriminator key is now escaped the same way as the object keys it refers to.
