---
'@mastra/playground-ui': patch
---

Fixed invisible leftover popups by upgrading Base UI to 1.7.0. Quick repeated hovers could cancel a popup's exit animation and leave it permanently mounted (mui/base-ui#5395); reopened popups could also flash at stale coordinates before repositioning. Both are fixed upstream in 1.7.0.
