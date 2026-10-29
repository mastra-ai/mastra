---
'@mastra/playground-ui': minor
---

Studio's model picker now shows full model names instead of cutting them off, so similar models like `moonshotai/kimi-k2-thinking` and `moonshotai/kimi-k2-0905` are easy to tell apart. `Combobox` has a new `popupWidth="content"` option that fits the popup to its longest option and keeps that width while you search.

```tsx
<Combobox options={modelOptions} popupWidth="content" />
```
