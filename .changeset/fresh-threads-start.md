---
'mastracode': minor
---

Added `mastracode --new`, which opens the TUI on a new thread instead of resuming the latest thread for the directory. Saved threads are kept, and `/threads` still lists them. `--new` can't be combined with `mastracode resume <thread-id>`, and Factory mode ignores it.
