---
"@mastra/quickjs": patch
---

Fix the CJS build failing every program with `(0, ts_blank_space.default) is not a function`. `ts-blank-space` (and the `typescript` API it runs on) are ESM-only and cannot be `require()`d, so the CJS output now bundles them while the ESM output keeps them external.
