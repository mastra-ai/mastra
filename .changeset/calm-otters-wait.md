---
'@mastra/e2b': patch
---

**Fixed commands that read stdin hanging until timeout**

Commands that read standard input without being given anything to read — a bare `cat`, or `grep`/`rg` with no path argument — blocked until the command timeout expired. Commands run through `executeCommand()` no longer keep stdin open, so these commands see end-of-input and exit immediately.

`processes.spawn()` is unchanged: it still keeps stdin open so long-running processes can be driven with `sendStdin()`.
