---
'@mastra/core': patch
---

Fixed tool validation error messages showing `[object Object]` instead of the field name when using schema libraries whose issue paths use object-form segments (`{ key }`), such as Valibot and ArkType. Error messages now resolve the actual field path in all cases.
