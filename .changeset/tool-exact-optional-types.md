---
'@mastra/core': patch
---

Fixed a TypeScript error when passing tools made with `createTool` to `new Mastra({ tools })` in projects that enable `exactOptionalPropertyTypes`. You no longer need a cast to register these tools.
