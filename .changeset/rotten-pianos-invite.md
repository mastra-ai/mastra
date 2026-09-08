---
'@mastra/code-sdk': patch
---

Stop advertising Bedrock models that cannot be served over Converse. Nine `bedrock-mantle` entries in the models.dev catalog carry a `provider` override pointing at a different endpoint and API shape, but every catalog id is handed to `createAmazonBedrock()`, so they appeared in the `/models` picker and in packs while being unreachable. They are now filtered out of the advertised catalog.
