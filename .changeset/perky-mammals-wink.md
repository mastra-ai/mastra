---
'@mastra/core': patch
---

Added `child(bindings)` to the `IMastraLogger` interface, standardizing how component-scoped loggers are created. All logger implementations (`ConsoleLogger`, `PinoLogger`, `DualLogger`, `MultiLogger`, `noopLogger`) now accept `Record<string, unknown>` in `child()`. This fixes a bug where PinoLogger received a raw string instead of an object, causing each character to be serialized as a separate log field (e.g. `0: "B", 1: "U", 2: "N"...`).
