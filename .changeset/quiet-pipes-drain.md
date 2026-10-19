---
'@mastra/code-sdk': patch
---

Fixed headless runs cutting off their output when stdout is a pipe. The CLI exited before Node finished writing, so a large final result could reach the reader incomplete while the process still exited with code 0. Headless mode now waits for stdout and stderr to flush before exiting. If the output can't be delivered because the reader closed the pipe, a run that would otherwise succeed exits with code 1 instead of 0. A run that already failed keeps its exit code.
