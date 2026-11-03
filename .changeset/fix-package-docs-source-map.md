---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed the `SOURCE_MAP.json` file shipped with the package docs. It previously listed minified names such as `t` and `n`, so tools that look up exports could not find `Agent`, `createTool` or `Mastra`. The map now lists every public export by name, with the type definition file that declares it and the line where it is implemented.
