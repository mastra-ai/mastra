---
'mastra': minor
---

Added automatic Factory UI packaging to `mastra build` and `mastra deploy`. When a Software Factory project is detected, the CLI copies its prebuilt Factory SPA into `.mastra/output/factory/`; projects no longer need to build the SPA separately.

```sh
npx mastra build --dir src/mastra
```

The resulting deployment contains `.mastra/output/factory/index.html`.
