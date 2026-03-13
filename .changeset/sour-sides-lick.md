---
'@mastra/playground-ui': patch
---

Improved studio loading performance by lazy-loading the Prettier code formatter. Prettier and its plugins are now loaded on-demand when formatting is triggered, rather than being bundled in the initial page load.
