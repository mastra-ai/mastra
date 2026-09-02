---
'@mastra/core': patch
---

Fixed observability signals from Studio (mastra dev) being tagged with environment: production. Runs started through mastra dev now resolve to development unless an explicit environment is configured. Fixes #21941
