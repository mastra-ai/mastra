---
'@mastra/schema-compat': patch
---

Fixed OpenAI strict-mode schema preparation rejecting `allOf` object schemas with properties named `constructor`, `toString`, or `__proto__`.
