---
'mastracode': patch
---

Mastra Code starts with about 45% less memory on Node 24: an idle session now uses ~220 MB instead of ~410 MB. Code previews load only the syntax highlighting language they need, and the CLI restarts Node once at launch with a smaller young-generation heap (`--max-semi-space-size=8`), which matters on Node 24, where the default is larger. Set `MASTRACODE_NO_HEAP_FLAGS=1` to start without the heap flag.
