---
'@mastra/pg': patch
---

Fixed PostgreSQL dataset reads and writes to preserve JSON null and JSON-looking strings in item input, groundTruth, and expectedTrajectory across insertion, updates, and version history. Existing externalId retry equivalence is unchanged: omitted and null payload fields compare equally, and a retry returns the original stored representation. Previously lost SQL NULL distinctions cannot be recovered.

Unset or cleared target type, target IDs, and scorer IDs now return undefined, matching in-memory and LibSQL storage. Serialized responses omit these properties instead of returning null. Consumers should use nullish checks rather than require explicit null properties.
