---
'@mastra/core': patch
---

Updated the jsonSchemaPropertiesToTSTypes function to properly handle JSON Schema definitions where type can be an array of strings. Previously, the function only handled single string types, but according to the JSON Schema specification, type can be an array of possible types.
