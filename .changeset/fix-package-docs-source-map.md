---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed the `SOURCE_MAP.json` file shipped with the package docs. It previously listed minified names such as `t` and `n`, so tools that look up public exports could not find them. The map now lists public exports by name. Each entry points to the type definition file that declares the export and the line where it is implemented, when those can be resolved; otherwise it falls back to the module's main type definition file. Default exports and names the package re-exports from another package are left out.
