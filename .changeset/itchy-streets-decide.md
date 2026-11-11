---
'@mastra/factory': patch
---

Fixed a Factory session staying marked as running on other people's boards after it switched to another thread, started a new one or deleted its thread in the middle of a run. Open boards now hear about it right away.
