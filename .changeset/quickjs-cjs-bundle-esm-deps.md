---
'@mastra/quickjs': patch
---

Fix the CommonJS build of `@mastra/quickjs` so programs run. Previously every `run()` failed with `(0, ts_blank_space.default) is not a function` because the CJS bundle externalised the ESM-only `ts-blank-space`. The build now splits per format: ESM keeps `ts-blank-space` and `typescript` external, while CJS bundles them in.
