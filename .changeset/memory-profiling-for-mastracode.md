---
'mastracode': patch
---

Added built-in memory profiling support. The `MemoryProfiler` samples `process.memoryUsage()` at a configurable interval (default 10s) and writes a JSONL timeline to `~/.local/share/mastracode/profiles/`. Automatic V8 heap snapshots can be triggered when heapUsed or RSS crosses a threshold. Controlled via `MASTRACODE_PROFILE=1` env var at startup or interactively with `/profile start`, `/profile stop`, `/profile status`, and `/profile snapshot`.
