---
'mastracode': patch
---

Give the MastraCode web status line TUI parity. It now mirrors the TUI: `msg pending/threshold ↓removal` (the message window before the next observation), `mem observed/reflection ↓savings` (observations before the next reflection), and an active-goal indicator, with severity coloring as a budget fills. The underlying `omProgress` / `tokenUsage` fields and the `display_state_changed` event ship in `@mastra/server` / `@mastra/client-js`.

Also fixes the Settings panel overflowing the viewport with no way to scroll: the panel is now capped to the viewport height with a scrollable body and a pinned header.
