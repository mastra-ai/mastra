---
'@mastra/core': patch
'@mastra/mcp': patch
---

Tool validation failures no longer write submitted values to logs. Logs now record the tool and the failing field paths, such as `issuePaths: ["email"]`. Errors returned to the model or MCP caller are unchanged, so it can still correct its call. Fixes #29318.

`@mastra/core/tools` now exports `getValidationIssuePaths`, which returns the failing field paths of a validation error and masks dynamic keys such as record keys as `*`.

`@mastra/mcp` now requires `@mastra/core` 1.83.0 or later.
