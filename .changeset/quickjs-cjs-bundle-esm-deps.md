---
'@mastra/quickjs': patch
---

Fix the CommonJS build of `@mastra/quickjs` so every program can run. The CJS bundle externalised `ts-blank-space`, which is ESM-only and pulls in `typescript`, so at runtime `require("ts-blank-space")` produced a namespace whose `.default` was not callable — every `run()` failed with `(0, ts_blank_space.default) is not a function` on Node >=22.12 (and `ERR_REQUIRE_ESM` on older Node). The build now splits per format: the ESM output keeps these dependencies external, while the CJS output bundles them in.
