---
'@mastra/core': minor
---

Added an optional `pricing` field to gateway provider configs. A custom gateway can now state what its models cost, in USD per 1 million tokens with the same keys as models.dev, so calls to private or reseller models get cost estimates.
