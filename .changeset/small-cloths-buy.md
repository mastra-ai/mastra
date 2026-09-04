---
'create-factory': minor
---

Added non-secret `.mastra-project.json` metadata after platform project creation so generated Factory projects can resolve hosted API commands automatically.

```bash
npm create factory
cd my-factory
mastra api factory project list
```
