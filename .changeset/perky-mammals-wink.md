---
'@mastra/core': patch
---

Fixed `__setLogger` passing a raw string to `logger.child()`, which caused PinoLogger to serialize each character as a separate log field (e.g. `0: "B", 1: "U", 2: "N"...`). Now passes `{ component }` object instead.
