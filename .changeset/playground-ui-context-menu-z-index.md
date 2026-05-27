---
'@mastra/playground-ui': patch
---

`ContextMenu` Positioner and popup raised from `z-50` to `z-1000` with `isolate`, so the menu sits above app chrome that uses higher stacking contexts (e.g. sticky headers with `z-500`). Previously the menu would render behind such elements when opened on triggers near them.
