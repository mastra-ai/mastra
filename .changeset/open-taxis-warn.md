---
'@mastra/playground-ui': patch
---

Fixed MCP App iframes so third-party app HTML cannot run with the Studio page's origin. Guest HTML loads in a nested frame that cannot read the parent page or call Studio with the viewer's cookies.
