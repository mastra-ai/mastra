---
'@mastra/mcp': minor
'@mastra/core': patch
---

Added native multimodal tool-result support. Core now converts MCP-style tool results with image and audio `content` parts into model-native media output when building model prompts, without requiring MCP tools to persist duplicate media payloads in `providerMetadata.mastra.modelOutput`.

```ts
return {
  content: [
    { type: 'text', text: 'Screenshot captured' },
    { type: 'image', data: base64Png, mimeType: 'image/png' },
  ],
};
```
