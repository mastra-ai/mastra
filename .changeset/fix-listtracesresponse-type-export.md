---
'@mastra/core': patch
---

Fix ListTracesResponse type export from @mastra/core

The `ListTracesResponse` type (and other storage types) were not properly exported from the main `@mastra/core` package entry point. This caused TypeScript to show `any` type when importing `ListTracesResponse` from `@mastra/core/storage`.

The fix adds `export * from './storage';` to the main index.ts to ensure all storage module types are properly exported and can be used by consumers.

