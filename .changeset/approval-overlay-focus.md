---
'mastracode': patch
---

A plan approval arriving while a command overlay (such as the /models pack selector) is open no longer steals focus from the overlay or deadlocks it. The approval defers its focus until the overlay closes, then takes focus so it must still be answered.
