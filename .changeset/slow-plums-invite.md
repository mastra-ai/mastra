---
'@mastra/core': patch
---

Fixed image attachments from @ai-sdk/react and @ai-sdk/vue clients throwing errors. File parts using the AI SDK v5 UIMessage format ({ type: 'file', url: '...', mediaType: '...' }) are now handled correctly when routed through the ModelMessage code path.
