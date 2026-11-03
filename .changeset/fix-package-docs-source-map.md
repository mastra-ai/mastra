---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed the `SOURCE_MAP.json` file shipped with the package docs. It previously listed minified names such as `t` and `n`, so tools that look up exports could not find `Agent`, `createTool` or `Mastra`. The map now lists public exports by name, with the type definition file that declares each one and the line where it is implemented. Default exports and names the package re-exports from another package are left out.
