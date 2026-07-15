---
'@mastra/core': patch
---

Fixed a crash on Cloudflare Workers where calling generate() on an Agent not registered to a Mastra instance threw `TypeError: this.#intervalHandle.unref is not a function`. The scheduler now only calls unref() on its polling interval when the runtime provides it (Node.js); on runtimes where setInterval returns a number (workerd) the call is skipped. Fixes [#19462](https://github.com/mastra-ai/mastra/issues/19462).
