---
'mastra': patch
---

Improve Bun runtime support in the CLI.

**Fix `bun create mastra`**: Automatically installs `@mastra/server` to work around Bun issue #25314 where Bun doesn't respect npm's deprecated flag.

**Auto-detect runtime for `mastra dev` and `mastra build`**: The generated server entry now uses `createServer()` which automatically detects the runtime (Bun vs Node.js) and uses the appropriate server implementation (`Bun.serve()` for Bun, `@hono/node-server` for Node.js).
