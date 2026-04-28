---
'@mastra/deployer': patch
---

Fixed slow or stuck `mastra dev` startup in large monorepos when workspace packages share internal dependencies.

**What changed**

- Mastra now avoids repeating the same dependency analysis work during dev startup when multiple workspace packages depend on the same internal package.
- This reduces repeated startup work in large monorepos and helps the dev server reach a ready state more reliably.

Fixes #12843.
