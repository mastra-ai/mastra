---
'mastracode': patch
---

Improved how Mastra Code shows elapsed times. The status line, idle line, tool and shell rows, retry delays, and `/schedules` countdowns now use spaced units like `1h 20m idle`, `4m 5s` and `2d 3h`. Previously they mixed styles such as `1hr20m`, `2days3hr` and `1m5s`, and some counters showed long times only in seconds (for example `125s`).
