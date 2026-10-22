---
'@mastra/playground-ui': patch
---

Nothing changes for apps that install this package from npm. Inside the Mastra monorepo, apps now read this package's TypeScript source during development through a `@mastra/source` export condition, so editing a component hot-updates that component instead of waiting for a rebuilt package. The source files are not published, so the condition has no effect outside the monorepo.
