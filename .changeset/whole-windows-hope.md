---
'@mastra/acp': minor
---

Added programmatic model selection for ACP agents using the `model` option.

You can now set the model directly when creating `AcpAgent` or `createACPTool`, instead of relying on environment variables.

```ts
const codeAgent = new AcpAgent({
  id: 'code-agent',
  description: 'ACP-compatible coding agent',
  command: 'claude',
  args: ['--acp'],
  model: 'claude-sonnet-4-20250514',
});
```

Discover available models with `getAvailableModels()` and change the model at runtime with `setModel()`. Invalid model IDs throw a descriptive error listing valid options.
