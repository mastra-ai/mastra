---
'@mastra/schema-compat': patch
---

Optional nested JSON Schema properties with multiple types no longer produce exponentially large OpenAI tool payloads. Payload growth now remains linear as these schemas become more deeply nested.
