---
'mastra': patch
---

Fixed `npm create mastra@alpha` (and other prerelease channels) failing during install with an ERESOLVE peer dependency error. Projects created with npm on a prerelease channel now pin every package to the project's `@mastra/core` through an `overrides` entry in `package.json`, so the first install and later `npm install` commands both work.
