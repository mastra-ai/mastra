---
'mastra': patch
---

Fixed an issue where running several Mastra CLI commands at the same time could log you out. The commands now share one refreshed login instead of conflicting with each other.
