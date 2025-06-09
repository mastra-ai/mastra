---
'@mastra/core': patch
---

- add trackException to loggers to allow mastra cloud to track exceptions at runtime
- Added generic MastraBaseError<D, C> in packages/core/src/error/index.ts to improve type safety and flexibility of error handling
