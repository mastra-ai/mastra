---
'mastracode': patch
---

Durations in Mastra Code now read the same way everywhere, with spaced units like `1h 20m idle`, `4m 5s` and `2d 3h`. Previously the CLI mixed styles such as `1hr20m`, `2days3hr` and `1m5s`, and some counters showed long times only in seconds (for example `125s`).
