---
'mastracode': patch
---

Fixed fatal 'Cannot find module ../../package.json' error when running mastracode after installing from npm. The version is now inlined at build time instead of requiring the package.json file at runtime.
