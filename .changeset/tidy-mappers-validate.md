---
'@mastra/core': patch
---

Fixed `CompositeAuth` resource mapping validation to reject invalid IDs from the authenticating provider while preserving providers without a mapper, including nested composites.
