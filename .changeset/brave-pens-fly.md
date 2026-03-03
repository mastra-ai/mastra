---
'@mastra/react': patch
'@internal/playground': patch
---

fix(@mastra/react): externalize @mastra/core instead of inlining it into dist

`rollup-plugin-node-externals` doesn't catch workspace-linked packages (`workspace:*`),
so `@mastra/core` was being fully bundled into `@mastra/react`'s dist (~900KB). Added an
explicit `external` rule to keep core as an external import, and moved it from
`devDependencies` to `dependencies` so it's properly resolved at runtime.

Also added Node.js builtin stubs to `@internal/playground`'s Vite config so it can
resolve core's server-only chunk imports (voice, workspace tools) without erroring
during the browser build.
