---
'@mastra/quickjs': minor
---

Added `@mastra/quickjs`, a Code Mode transport that runs model-authored programs in an in-process QuickJS runtime compiled to WebAssembly. It gives the same isolation as `@mastra/isolated-vm` — no filesystem, network, or process access, only your allow-listed tools — without installing a native addon or starting Node.js with `--no-node-snapshot`, so Code Mode now works on serverless hosts that forbid both. Programs run slower than in a V8 isolate, which mostly affects compute-heavy code rather than code that awaits tool calls. See https://github.com/mastra-ai/mastra/issues/20546
