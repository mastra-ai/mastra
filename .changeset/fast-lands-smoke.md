---
'@mastra/server': patch
---

Fixed non-Zod Standard Schema types (e.g. ArkType) being incorrectly called as lazy getters in resolveLazySchema, which caused Studio UI tool forms to receive validation errors instead of the actual JSON Schema
