---
'mastra': patch
---

Added `mastra api factory project environment get` and `update` to read and change a Factory project's sandbox environment: provider settings, the workspace setup command and the repository order.

```bash
mastra api factory project environment update <project-id> '{"settings":{"cpuCount":2}}'
```
