---
'@mastra/qdrant': patch
---

Fixed `QdrantVector.deleteVectors` reporting success when Qdrant rejected the request. IDs that are not unsigned integers or UUIDs now throw a clear error instead of silently deleting nothing.
