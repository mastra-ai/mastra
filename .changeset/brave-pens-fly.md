---
'@mastra/react': patch
'@internal/playground': patch
---

fix(@mastra/react): externalize @mastra/core instead of inlining it into dist

`rollup-plugin-node-externals` doesn't catch workspace-linked packages (`workspace:*`),
so `@mastra/core` was being fully bundled into `@mastra/react`'s dist (~900KB). Switched
from Vite/Rollup to tsup with explicit externalization, and moved `@mastra/core` to
`peerDependencies` so consumers provide it rather than having it bundled inline.

Also added Node.js builtin stubs to `@internal/playground`'s Vite config so it can
resolve core's server-only chunk imports (voice, workspace tools) without erroring
during the browser build.
