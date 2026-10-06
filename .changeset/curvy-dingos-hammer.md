---
'mastracode': minor
---

Moved model-pack ownership into Mastra Code. Model choices now belong to the active pack instead of individual threads, and switching modes applies the pack's model for the new mode.

To change a mode's model, open `/models`, select that mode, and update the active pack. Shift+Tab or `/mode` then applies the model configured for the selected mode. Existing per-thread, per-mode model overrides are no longer used.
