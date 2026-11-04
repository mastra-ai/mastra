---
'@mastra/core': patch
---

Fixed `.foreach()` applying a finished item's state changes twice after a restart. If the process stopped at the wrong moment, the saved run could hold an item's state changes without marking the item as finished, so restarting the run ran that item again on top of its own changes. An item is now saved as finished together with its state changes.
