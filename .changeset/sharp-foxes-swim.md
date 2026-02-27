---
'@mastra/daytona': patch
---

Added internal `_processManagerOverride` option to `DaytonaSandboxOptions` and two prototype process manager implementations for evaluating alternative Daytona process APIs:

- **PTY Process Manager** (`process-manager-pty.ts`): Full PTY-based implementation using WebSocket streaming with `exec`-based command wrapping, sentinel-based exit code parsing, and deferred stderr via temp file.
- **Hybrid Process Manager** (`process-manager-hybrid.ts`): Session API for spawn (identical to current) with PTY-based fallback in `get()` for reconnecting to externally-spawned processes.
