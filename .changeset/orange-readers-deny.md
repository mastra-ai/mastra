---
'mastracode': patch
---

Fixed Mastra Code using CPU while idle after starting a new thread, switching threads, cloning a thread, or switching resources while a shell command was still running. The running command's row kept redrawing the screen 10 times a second until you quit.
