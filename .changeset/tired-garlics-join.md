---
'mastracode': patch
---

Mastra Code starts with about 45% less memory: an idle session now uses ~220 MB instead of ~410 MB. The CLI restarts Node once at launch with a smaller young-generation heap (`--max-semi-space-size=8`), and code previews load only the syntax highlighting language they need. Set `MASTRACODE_NO_HEAP_FLAGS=1` to start without the heap flag.
