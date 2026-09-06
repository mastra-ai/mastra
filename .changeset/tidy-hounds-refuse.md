---
'@mastra/playground-ui': patch
---

Moved clsx, tailwind-merge and class-variance-authority from devDependencies to dependencies. They are imported at runtime, so `nodeExternals()` skipped them and Rollup inlined them into the published output — a 101 kB shared chunk that 78 of the package's entries imported, and a second copy of tailwind-merge for any app that already had one. They now resolve from the consumer's own install.
