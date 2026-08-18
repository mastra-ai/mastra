---
'@mastra/core': patch
---

Estimate media token cost in TokenLimiterProcessor instead of serializing base64 payloads as text. File parts and media-shaped tool results (`{ data, mediaType }`) previously fell through to `JSON.stringify`, so a single image could add thousands of phantom tokens and truncate history unnecessarily (#21731).
