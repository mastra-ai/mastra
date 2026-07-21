---
'create-factory': patch
---

Added the `create-factory` CLI. It scaffolds a Mastra Software Factory project: enter a project name and the CLI clones the template, installs dependencies, and initializes git. Configuration (model providers, integrations, database) happens in the web UI on first load.

```bash
npm create factory my-factory
cd my-factory
npm run dev
```
