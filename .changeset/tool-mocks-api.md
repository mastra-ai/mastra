---
'@mastra/server': patch
'@mastra/client-js': patch
---

Expose item-level tool mocks through the dataset API and client SDK. Dataset item create/update/batch endpoints accept a `toolMocks` array (toolName + args + output + optional `matchArgs` mode), experiment result responses include the `toolMockReport`, and the client-js types thread `toolMocks` and `toolMockReport` through the dataset item and experiment result types.
