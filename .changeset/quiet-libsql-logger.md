---
'@mastra/core': patch
'@mastra/libsql': patch
---

Fixed LibSQL storage printing raw database errors to the console when the Mastra logger was disabled (`logger: false`) or replaced with a custom logger. Storage domains now use the configured Mastra logger, and failed-write diagnostics only include the error name, error code, and retry counts instead of the full error, its cause, stack, or SQL. The original error is still thrown to the caller.
