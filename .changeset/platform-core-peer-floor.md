---
'@mastra/platform': patch
---

Require a stable `@mastra/core` release from 1.84.0 up to (not including) 2.0.0, or a 1.84.0 prerelease from 1.84.0-alpha.6 on. `PlatformKnowledge` reads its scope declarations from the Knowledge instance, which older core releases can't do, so every Knowledge call failed with `does not match a declared scope type`.
