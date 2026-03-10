---
'@mastra/qdrant': patch
---

Fixed `upsert` error when the `ids` parameter is provided as a `uint64` cast to a string, which should be valid to upsert
with Qdrant, as defined in [Qdrant API - Upsert Endpoint](https://api.qdrant.tech/api-reference/points/upsert-points#request.body.PointsList.points.id).
