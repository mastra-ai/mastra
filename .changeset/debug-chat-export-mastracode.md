---
'mastracode': minor
---

Added `/debug-chat-export` slash command that dumps the active thread, every message in it, the current observational memory record, and prior OM generations to a timestamped directory under the mastracode app data dir. The export also captures the running mastracode version, observer/reflector models, and thresholds so the dump is enough to reproduce surprising OM behavior (e.g. unexpected reflections or skewed token counts) in a bug report.

Generated files (all inside a `debug-exports/<timestamp>-<thread-prefix>/` directory):
- `manifest.json` — top-level summary
- `thread.json` — thread metadata
- `messages.json` — all persisted messages in the thread
- `om-current.json` — active OM record (or null)
- `om-history.json` — previous OM generations (newest first)
- `meta.json` — mastracode version, model IDs, thresholds, harness state
- `README.md` — export layout and privacy warning

**Privacy note**: Exported files may contain full message text. Directories are created with `0o700` permissions and files with `0o600` to limit unintentional access.
