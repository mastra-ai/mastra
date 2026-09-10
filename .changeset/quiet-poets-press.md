---
'@mastra/core': patch
---

Fixed sandbox commands hanging when they read standard input.

`executeCommand()` used to hand a one-shot command an open stdin pipe that nothing ever wrote to or closed. Commands that fall back to reading standard input when given no file arguments — `rg`, `grep`, `cat`, `sort`, `wc` — blocked until they were killed, and the caller saw an unexplained exit code 128. They now get an empty stdin and finish immediately:

```ts
// Previously hung until killed; now returns right away
await sandbox.executeCommand('rg -l "needle" --glob "*.test.ts" | head -5');
```

Spawned processes are unchanged — their stdin stays open for `sendStdin()`. The new `stdin` option ('pipe' | 'ignore') on `executeCommand()` and `processes.spawn()` overrides the default either way.

A process ended by a signal now also reports which signal on stderr, instead of only surfacing exit code 128.
