---
'mastracode': patch
---

Render inline images in the mastracode TUI for tool results that return media parts (e.g. the browser screenshot tools). Only the most recent image renders as actual pixels in the terminal; older screenshots show a `(image)` placeholder so they don't pile up in scrollback or fight with overlays.
