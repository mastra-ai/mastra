---
'@mastra/core': patch
---

Fixed CommonJS TypeScript resolution for `@mastra/core/workflows` in `moduleResolution: "nodenext"` projects.

Static imports from `@mastra/core/workflows` now resolve through a CommonJS declaration file for the `require` export condition, which avoids `TS1479` in CommonJS consumers.
