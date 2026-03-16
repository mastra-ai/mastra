---
'mastracode': patch
---

Fixed potential rendering artifacts by removing border string caching in the editor input box. Borders are now recomputed each frame to ensure they stay in sync with terminal dimensions.
