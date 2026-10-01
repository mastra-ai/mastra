---
'@mastra/core': patch
---

Fixed tool request context validation accepting invalid values when `requestContextSchema` is a Valibot schema. Valibot returns both a value and issues on failure, and the issues are now reported instead of being ignored.
