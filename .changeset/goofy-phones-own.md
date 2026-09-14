---
'@mastra/playground-ui': patch
---

Added timed key sequences to `useKeydown`. Bindings like `g$+a` fire when `g` is pressed and then `a` within a fixed 500ms window, enabling GitHub-style shortcuts. `useKeydown` now also ignores unmodified keys (e.g. `?`, `g`) while the user is typing in an input, textarea, contenteditable field (including empty and `plaintext-only` attributes), combobox or other keyboard widget, so single-character shortcuts no longer block typing; modifier combos like `mod+k` keep working from anywhere.
