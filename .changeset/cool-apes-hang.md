---
'@mastra/e2b': patch
---

Fix E2B sandbox creation failing with "Sandbox.betaCreate is not a function" on e2b SDK 2.24.0+. The adapter now uses the stable `Sandbox.create()` API with `lifecycle: { onTimeout: 'pause' }` (replacing the removed `betaCreate`/`autoPause`), and requires `e2b >= 2.24.0`.
