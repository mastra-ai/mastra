---
'mastra': patch
---

Fixed `npm create mastra@alpha` (and other prerelease channels) failing during install with an ERESOLVE peer dependency error. Projects created with npm on a prerelease channel now include an `.npmrc` that lets npm accept the prerelease `@mastra/core`, so the first install and later `npm install` commands both work.
