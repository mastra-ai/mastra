---
'@mastra/core': major
'@mastra/memory': major
'@mastra/rag': major
'@mastra/fastembed': major
'@mastra/mcp': major
'@mastra/server': major
'@mastra/client-js': major
---

Mastra now supports AI SDK v7 only. Models must implement the v7 provider spec (`specificationVersion: 'v4'`); v5 and v6 models now throw an error. AI SDK types and helpers are exported from `@mastra/core/ai`, and test mocks from `@mastra/core/ai/test`. `MessageList` exposes one `aiSdk` view in place of `aiV5`, `aiV6`, and `aiV7`.

```ts
// Before
messageList.get.all.aiV5.model();
// After
messageList.get.all.aiSdk.model();
```

`@mastra/fastembed` exports only v7 models (`smallV2` and `baseV2` are removed). `embedV2` and `embedV3` are replaced by `embed`.
