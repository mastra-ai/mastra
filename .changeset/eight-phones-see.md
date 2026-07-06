---
'mastracode': patch
---

Refactored the web chat UI internals to remove prop drilling: the app shell, sidebar, and overlays now read project selection, chat session state, and overlay visibility from dedicated React contexts. No user-facing behavior changes.
