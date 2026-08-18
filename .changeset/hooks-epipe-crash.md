---
'@mastra/code-sdk': patch
---

Stop an unread hook stdin from crashing the host process. A hook command that exits without reading its stdin closes the pipe mid-write, and the resulting EPIPE arrived as an unhandled socket error rather than a throw, so the surrounding `try/catch` never saw it and Node tore the process down. The socket error is now absorbed; the hook's real outcome still comes from its exit code.
