---
'@mastra/schema-compat': patch
---

Fixed Groq provider not receiving schema compatibility transformations, which caused HTTP 400 errors when AI models omitted optional parameters from workspace tool calls (e.g. list_files). Groq now correctly gets the same optional-to-nullable schema handling as OpenAI.
