---
'@mastra/playground-ui': minor
---

`ModelPicker` takes `customModel`, which turns the search text into a "Use provider/model" option for a model the list doesn't have, and `chevron={false}` to drop the trigger's chevron when the whole row is the trigger. The picker shows whatever `customModel` returns, so return `undefined` for an empty provider or model and for models already listed.

```tsx
<ModelPicker
  providers={providers}
  value={value}
  onValueChange={setValue}
  customModel={query => {
    const slash = query.indexOf('/');
    if (slash <= 0 || slash === query.length - 1) return undefined;
    return { provider: query.slice(0, slash), model: query.slice(slash + 1) };
  }}
  chevron={false}
/>
```
