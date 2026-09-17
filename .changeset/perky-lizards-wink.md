---
'mastracode': patch
---

Fixed Tab-completing a `/skill/<name>` or `/goal/<name>` command dropping the leading slash. The command now runs as expected instead of being sent to the model as a plain message, and Tab adds a trailing space so you can keep typing arguments.
