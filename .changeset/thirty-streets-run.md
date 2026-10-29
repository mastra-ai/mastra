---
'@mastra/playground-ui': patch
---

Fixed long option labels being cut off in `Combobox` popups that need to show ids, such as model names. The new `popupWidth="content"` option fits the popup to its longest option (up to 20rem) instead of the trigger's width and keeps that width while you search. Labels longer than that wrap onto a second line.

```tsx
<Combobox options={modelOptions} popupWidth="content" />
```
