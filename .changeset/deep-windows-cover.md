---
'@mastra/react': patch
---

Fixed tool error text displaying as [object Object] when a serialized delegation error retains its message only in its cause. Added optional errorText to DynamicToolPart for renderers. Partial child output already received during streaming is retained when a delegation fails.
