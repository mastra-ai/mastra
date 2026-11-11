---
'@mastra/mcp': patch
---

Now requires `@mastra/core` 1.83.0 or later, the first release that exports `getValidationIssuePaths`. Installing `@mastra/mcp` with an older `@mastra/core` fails at import, so upgrade `@mastra/core` to 1.83.0 or later when moving to this release.
