---
'create-factory': patch
---

Fix generated Software Factory projects failing to start with `Cannot find package '@mastra/e2b'`. The scaffold imports `@mastra/e2b` for its sandbox provider, but the template generator's runtime dependency list omitted it, so the generated `package.json` never installed it. The list is now covered by a test asserting the template declares every `@mastra/*` package its entrypoint imports.
