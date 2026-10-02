---
'@mastra/code-sdk': patch
---

Fixed headless `mastracode --prompt` runs leaving signal socket files under `/tmp/mc` behind on exit. Shutdown now stops notification delivery, then closes the signals connection after the workers stop. A closed signals connection no longer reopens lease files when a timer fires during shutdown.
