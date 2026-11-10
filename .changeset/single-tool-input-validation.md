---
'@mastra/core': patch
---

Agent tool calls now validate tool input exactly once. Tools whose input schema transforms values (for example a string into a `URL`) now work with `generateLegacy` and `streamLegacy` instead of failing with `DataCloneError`, and a `Tool` created by a second installed copy of `@mastra/core` no longer rejects the decoded input it receives from an agent.
