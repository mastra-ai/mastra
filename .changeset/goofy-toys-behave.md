---
'mastracode': patch
---

Fixed fatal "fg is not defined" crash on startup by removing individual exports of theme functions (fg, bg, bold, italic, dim) from theme.ts. All TUI files now use the theme object exclusively, preventing undefined reference errors.
