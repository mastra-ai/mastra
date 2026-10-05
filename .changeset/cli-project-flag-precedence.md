---
'mastra': patch
---

The `--project` flag now takes precedence over the `MASTRA_PROJECT_ID` environment variable in `mastra connect`, `mastra env`, `mastra db`, `mastra server env`, `mastra server pause`/`restart`, and `mastra traces import`. Previously the environment variable silently won, so passing `--project` from a shell that exported `MASTRA_PROJECT_ID` targeted the wrong project. Headless deploys (`mastra deploy` with `MASTRA_API_TOKEN`) are unchanged.
