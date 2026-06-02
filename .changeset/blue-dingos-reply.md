---
'mastra': patch
---

Fixed project creation failing with pnpm v11 due to invalid packageManager range in package.json. pnpm v11 writes a semver range (e.g. pnpm@^11.3.0) into the packageManager field, but the spec requires an exact version. The range prefix is now stripped automatically.
