---
'@mastra/core': patch
---

Adds validation guards to handle undefined/null values that can occur when config objects are spread (`{ ...config }`). Previously, if getters or non-enumerable properties resulted in undefined values during spread, the constructor would throw cryptic errors when accessing `.id` or `.name` on undefined objects.

