---
'create-factory': minor
---

Standardized the Factory SPA directory and simplified the generated build script because `mastra build` now packages the prebuilt UI automatically.

Before:

```json
{ "build": "npm run build:ui && mastra build --dir src/mastra" }
```

After:

```json
{ "build": "mastra build --dir src/mastra" }
```

Factory assets now land in `src/mastra/public/factory/` during the build and `.mastra/output/factory/` in the deployable output, replacing the previous `ui/` path.
