---
'mastra': patch
---

Fixed server logs being hidden under `mastra start`. The command captured the running server's stderr into a buffer and only printed it if the process exited with an error, so warnings and errors from a healthy, running server (including channel and adapter logs) never appeared in the terminal. The server's stderr is now streamed through live as it happens, matching the behavior of `mastra worker`.
