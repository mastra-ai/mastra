---
'@mastra/factory': patch
---

A thinking slider dragged twice in a row no longer writes the second level again when you click away. Each release marks the level it is writing; the first write cleared that marker even when a later release had already replaced it, so a blur landing while the second write was still open sent it a second time. Only the release whose own write finishes clears the marker now.
