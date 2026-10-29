---
'@mastra/playground-ui': minor
---

Added `popupWidth="content"` to `Combobox`. The popup fits its longest option (up to 20rem) instead of the trigger's width, so long ids such as model names stay readable, and it keeps that width while you search. Labels longer than that wrap onto a second line instead of being cut off.

```tsx
<Combobox options={modelOptions} popupWidth="content" />
```
