---
'@mastra/playground-ui': minor
---

Added `displayLabel`, `showChevron`, and `iconOnlyValue` to `Combobox` so triggers can show a custom selected label, hide the chevron, or center an icon-only value.

```tsx
<Combobox options={countries} value={country} showChevron={false} iconOnlyValue />
```
