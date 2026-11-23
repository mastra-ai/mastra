---
'@mastra/playground-ui': minor
---

`ModelPicker` takes `fallbackModels`: each listed model gets a `Fallback` badge next to its name, numbered in list order (`Fallback 1`, `Fallback 2`) when there are several. Use it to show which models a request switches to when the selected one fails.

```tsx
<ModelPicker
  providers={providers}
  value={value}
  onValueChange={setValue}
  defaultModel={{ provider: 'anthropic', model: 'claude-opus-5.5' }}
  fallbackModels={[{ provider: 'openai', model: 'gpt-5.6-sol' }]}
/>
```
