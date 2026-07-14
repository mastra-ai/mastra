---
'mastracode': patch
---

Fixed TUI height corruption caused by unsanitized ANSI escape codes in tool output. pi-tui's extractAnsiCode() only handles CSI sequences ending with m/G/K/H/J; other terminators (cursor movement, mode switches) caused the scanner to swallow subsequent visible text, making visibleWidth() undercount and collapsing the TUI to a few rows. Added sanitizeAnsiForRendering() to strip non-SGR CSI sequences at all content entry points. Also improved terminal cleanup on exit to prevent Kitty keyboard protocol from leaking (5;99~ codes).
