---
'@mastra/schema-compat': patch
---

Fixed tool schema handling for Claude models hosted on Google Vertex (`@ai-sdk/google-vertex/anthropic`).

The Google compatibility layer matched on the `googleVertex` provider prefix and rewrote nullable fields into OpenAPI `nullable: true`, which Claude ignores. Claude on Vertex now uses the Anthropic compatibility layer, so `string | null` parameters keep JSON Schema `type: ['string', 'null']`. Gemini on Vertex is unchanged.
