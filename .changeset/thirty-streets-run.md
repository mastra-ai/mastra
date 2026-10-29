---
'@mastra/playground-ui': minor
---

Added `popupWidth="content"` to `Combobox`. The popup fits its longest option instead of the trigger's width, so long ids such as model names show in full, and it keeps that width while you search.

```tsx
<Combobox options={modelOptions} popupWidth="content" />
```
