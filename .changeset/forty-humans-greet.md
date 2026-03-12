---
'@mastra/core': patch
---

Fixed data-\* message parts (e.g. data-tool-call-suspended) being stripped during V4 adapter recall. Previously, filterDataParts() removed all parts with type starting with 'data-' when converting from DB to UI format, breaking HITL workflow resume after page refresh. Fixes #14196
