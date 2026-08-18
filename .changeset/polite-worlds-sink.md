---
'@mastra/factory': patch
---

The turn-end filesystem capture no longer blocks agent turn completion. Readers of the persisted workspace file listing wait for the in-flight capture (bounded) so they still observe the just-ended turn's files.
