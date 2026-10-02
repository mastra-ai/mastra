---
'mastracode': minor
---

Added `mastracode resume <thread-id>` to open a specific thread from the terminal. When you exit, Mastra Code prints the command to resume the current thread.

```sh
mastracode resume thread_abc123
```

Added `/resume` as an alias for `/threads` and `/rename` as an alias for `/name`.

Starting Mastra Code and quitting without sending a message no longer leaves an empty thread behind.
