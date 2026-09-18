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

`execute_command` with `background: true` also closes standard input: a background command that reads stdin now sees end-of-input instead of staying alive until it is killed. Retrieving that background process's handle no longer provides a writable stdin — use `processes.spawn()` with the default `'pipe'` mode for interactive processes.

`processes.spawn()` keeps a writable stdin by default so long-running processes can be driven with `sendStdin()`. It now also accepts a public `stdinMode` option — pass `'ignore'` to close stdin when nothing will feed it:

```ts
// opt-in: close stdin on a spawned process
const handle = await sandbox.processes.spawn('node server.js', { stdinMode: 'ignore' });
```

Output-only execution paths (`executeCommand()` and `execute_command` with `background: true`) pass this option automatically. Honored by the local, Docker, and E2B providers; other providers may not expose stdin control.
