---
'mastra': patch
---

Fixed a crash where `mastra start` could exit with `RangeError: Invalid string length`. The command retained every byte a running server wrote to stderr in an ever-growing buffer; on long-running or noisy servers this eventually exceeded the maximum string length and took down the process. The retained buffer is now capped at its most recent 1MB, which still contains the crash diagnostics it is inspected for ([#19581](https://github.com/mastra-ai/mastra/issues/19581)).
