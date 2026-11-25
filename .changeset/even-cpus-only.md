---
'@mastra/platform-workspace': patch
'@mastra/e2b': patch
---

Fixed the Factory sandbox CPU setting accepting an odd number above one, which sandboxes can't be created with. The setting is now a list of valid counts: 1, or an even number. A Factory already saved with an odd count goes back to the default the next time its sandbox settings are saved.
