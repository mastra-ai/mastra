---
'@mastra/evals': patch
---

Fixed the completeness scorer failing with `Cannot read properties of null (reading 'concat')` on some questions, such as "will Acme Box crash after the update?". `@mastra/evals` now requires `compromise` 14.20.0 or later, which contains the fix.
