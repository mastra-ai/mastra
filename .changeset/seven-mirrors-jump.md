---
'@mastra/e2b': patch
---

Fix sandbox creation crash on e2b SDK >= 2.24.0 by using the stable Sandbox.create() and lifecycle: { onTimeout: 'pause' } instead of the removed betaCreate()/autoPause.
