---
'@mastra/memory': patch
---

Fixed buffered reflection splitting an observation group when observational memory `retrieval` is enabled. The reflected slice now ends on a group boundary, so activated observations no longer contain orphaned `</observation-group>` tags or bullets cut off from their group.
