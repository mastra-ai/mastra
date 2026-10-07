---
'@mastra/playground-ui': minor
---

Added `ThinkingLevelUnavailable`, the disabled thinking trigger with a tooltip, for when no level can be picked yet, for example while the level loads.

```tsx
<ThinkingLevelUnavailable options={options} label="Thinking" reason="The thinking level isn't loaded yet." />
```

Fixed the first segment of a `ButtonsGroup` losing its rounded leading corner and border while its `Popover` is open.
