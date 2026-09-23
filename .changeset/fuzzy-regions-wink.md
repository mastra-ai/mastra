---
'@mastra/core': patch
---

Fixed in-memory dataset configuration reads to return undefined for unset or cleared tags, target type, target IDs, and scorer IDs, matching LibSQL. Serialized responses omit these properties instead of returning null. Consumers should use nullish checks rather than require explicit null properties. Empty arrays remain distinct from cleared settings.
