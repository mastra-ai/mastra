---
'@mastra/blaxel': minor
---

Blaxel background processes now support stdin. `sendStdin()` writes to the running process and `closeStdin()` sends EOF, so you can run interactive or stdio-based programs (such as MCP servers or CLI agents) in a Blaxel sandbox. Processes spawned with `stdinMode: 'ignore'` still start with stdin closed.

```ts
const handle = await sandbox.processes.spawn('node server.js');
await handle.sendStdin('{"jsonrpc":"2.0","method":"ping","id":1}\n');
await handle.closeStdin();
```

Process output from `handle.stdout`, `handle.stderr`, and the `onStdout`/`onStderr` callbacks now keeps line breaks. Before, `"a\nb\n"` came through as `"ab"`, which broke line-delimited protocols.
