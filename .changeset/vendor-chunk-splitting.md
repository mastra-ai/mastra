---
'@internal/playground': patch
---

Improved studio loading performance by splitting large vendor libraries (CodeMirror, XYFlow, PostHog) into separate chunks that the browser can download in parallel, reducing the main bundle from 5.8MB to 4.7MB.
