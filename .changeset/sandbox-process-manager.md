---
'@mastra/core': minor
'@mastra/e2b': minor
---

Added background process management to workspace sandboxes.

- `SandboxProcessManager` abstract base class with spawn/get/kill/list lifecycle and automatic `handle.command` tracking
- `ProcessHandle` with stdout/stderr accumulation, Set-based streaming listeners, and `wait()` with `onStdout`/`onStderr` callbacks
- `LocalProcessManager` implementation using `child_process.spawn`
- E2B process manager implementation wrapping E2B SDK commands API
- Shared conformance test suite in `@internal/workspace-test-utils`
- Shell execution refactor: `wrapCommand` takes a single command string, seatbelt/bwrap use `sh -c` internally, `shellQuote()` for safe arg escaping
