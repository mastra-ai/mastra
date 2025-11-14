---
'@mastra/arize': minor
---

fix(@mastra/arize): Auto-detect arize endpoint when endpoint field is not provided

When spaceId is provided to ArizeExporter constructor, and endpoint is not, pre-populate endpoint with default ArizeAX endpoint.
