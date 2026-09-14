---
'@mastra/playground-ui': patch
---

Added timed key sequences to `useKeydown`. Bindings like `g{300}+a` fire when `g` is pressed and then `a` within 300ms, enabling GitHub-style shortcuts. `useKeydown` now also ignores unmodified keys (e.g. `?`, `g`) while the user is typing in an input, textarea, combobox or other keyboard widget, so single-character shortcuts no longer block typing; modifier combos like `mod+k` keep working from anywhere.
