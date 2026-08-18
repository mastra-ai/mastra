---
'@mastra/factory': patch
---

The turn-end filesystem capture no longer blocks agent turn completion. Readers of the persisted workspace file listing wait up to 10 seconds for the in-flight capture to observe the just-ended turn's files; if a capture takes longer, a reader can temporarily receive the previous listing.
