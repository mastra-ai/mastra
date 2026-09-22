---
'@mastra/docker': patch
---

**Fixed commands that read stdin hanging until timeout**

Commands that read standard input without being given anything to read — a bare `cat`, or `grep`/`rg` with no path argument — blocked until the command timeout expired. The exec no longer attaches stdin unless something will feed it, so these commands see end-of-input and exit immediately.

`processes.spawn()` is unchanged: it still attaches stdin by default so long-running processes can be driven with `sendStdin()`.
