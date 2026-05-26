---
'mastracode': patch
---

**Fixed tool approval and other in-app keyboard shortcuts in modern terminals.**

In iTerm2, Ghostty, WezTerm, kitty and similar terminals, pressing `y` / `n` / `a` / `Y` on the tool approval dialog did nothing. The same was true for the `r` key on `/mcp` (reload servers), the `c` key on `/threads` (clone thread), and the space / enter shortcut on multi-step progress collapse.

The root cause was the Kitty keyboard protocol that pi-tui enables on supported terminals: printable keys arrive as CSI-u escape sequences (`\x1b[121u` for `y`) instead of raw bytes, so direct character comparisons silently dropped every press. Apple Terminal.app wasn't affected because it doesn't advertise the protocol.

All four surfaces now decode their shortcut keys through pi-tui's keyboard helpers so the same press works regardless of which keyboard protocol the terminal negotiates. `Shift+y` correctly maps to the uppercase `Y` YOLO shortcut; `Ctrl+Y` and `Alt+Y` no longer alias `Y`.
