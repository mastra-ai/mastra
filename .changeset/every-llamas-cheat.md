---
'@mastra/core': patch
---

Reduced the memory a Cloudflare Worker or Durable Object uses for `@mastra/core` when the Worker is minified (for example `wrangler deploy --minify`). The published JavaScript no longer contains characters outside Latin-1 in code, so the Workers runtime can store the bundled script at one byte per character instead of two. A minimal minified agent Worker went from about 31.5 MiB to 24.8 MiB of heap in local tests. Behaviour is unchanged.
