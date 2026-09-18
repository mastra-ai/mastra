---
'@mastra/core': patch
---

**Fixed commands that read stdin hanging until timeout**

Commands that read standard input without being given anything to read — a bare `cat`, `grep` or `rg` with no path argument, `read` — used to block until the command timeout expired, leaving tools stuck for minutes.

`executeCommand()` now runs commands with standard input closed, so anything that reads stdin sees end-of-input immediately and exits:

```ts
// previously hung until the timeout when the command read stdin
await sandbox.executeCommand('/bin/sh', ['-c', 'rg -n "pattern" --files-with-matches | head']);
```

`execute_command` with `background: true` closes standard input too: a background command that reads stdin now exits at end-of-input instead of staying alive until it is killed.

`processes.spawn()` is unchanged: it still opens a writable stdin by default so long-running processes can be driven with `sendStdin()`. Run-to-completion spawns pass the new `stdinMode: 'ignore'` option instead.
