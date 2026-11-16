---
'@mastra/factory': patch
---

New Factory databases no longer get the tables that only existed to migrate data from older releases (pre-split cards, the split progress marker, per-member intake settings, the original intake source bindings and their migration log). Databases created by an older release keep those tables and their data, and still migrate them on boot.
