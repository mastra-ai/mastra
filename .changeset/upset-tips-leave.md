---
'mastracode': minor
---

Added background shells to the TUI. They are off by default and turn on with the experimental background tools setting in `settings.json`:

```json
{ "backgroundTools": { "enabled": true } }
```

- A background shell row shows the exit code when the process ends, and a `↳ Shell finished · <description> (exit N)` row appears in the chat.
- Ctrl+G lists background shells next to background tasks, with how long each has run. Enter shows a shell's output, and D kills it.
