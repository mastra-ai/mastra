---
'mastracode': patch
---

Render inline images in the mastracode TUI for tool results that return media parts (e.g. the browser screenshot tools). Multiple images can render as actual pixels at the same time; once an image scrolls past the top of the visible viewport it collapses to a muted `(image)` placeholder and its terminal graphics placement is freed so it doesn't ghost or stack. Overlays (popups, model picker, etc.) still globally swap every image to the placeholder while open. Requires a graphics-capable terminal (Kitty, iTerm2, WezTerm, Ghostty, Konsole 25.04+); other terminals fall back to a text caption.
