---
'@mastra/platform': patch
---

Require `@mastra/core` 1.84.0 or later (1.84.0-alpha.6 or later for prereleases). `PlatformKnowledge` reads its scope declarations from the Knowledge instance, which older core releases can't do, so every Knowledge call failed with `does not match a declared scope type`.
