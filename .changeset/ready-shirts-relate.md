---
'@mastra/playground-ui': minor
---

`ModelPicker` takes `customModel`, which turns the search text into a "Use provider/model" option for a model the list doesn't have, and `chevron={false}` to drop the trigger's chevron when the whole row is the trigger. The picker shows whatever `customModel` returns, so return `undefined` for an empty provider or model and for models already listed. When two search results share a name, each one shows its full ID under the name.

```tsx
<ModelPicker
  providers={providers}
  value={value}
  onValueChange={setValue}
  customModel={query => {
    const [provider, model] = query.split('/');
    return provider && model ? { provider, model } : undefined;
  }}
  chevron={false}
/>
```
