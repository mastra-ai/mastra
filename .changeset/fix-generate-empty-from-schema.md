---
"@mastra/core": patch
---

Schema-based form inputs now correctly generate initial values for nested object properties and respect default values. Previously, pre-parsed schemas caused errors and nested objects were not initialized.
