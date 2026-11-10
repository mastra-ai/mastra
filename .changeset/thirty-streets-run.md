---
'@mastra/playground-ui': patch
---

Fixed long option labels being cut off in `Combobox`. Labels and descriptions now wrap and stop at two lines instead of truncating on one. A new `popupWidth` prop (`sm`, `md`, `lg`, `xl`) gives a compact trigger a wider, fixed popup for long options such as model ids. Without it the popup keeps the trigger's width.

```tsx
<Combobox options={modelOptions} popupWidth="lg" />
```
