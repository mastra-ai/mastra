---
'@mastra/playground-ui': patch
---

Added an optional `value` to `ThinkingLevelUnavailable`, so a control that is locked rather than unsupported still shows the level in effect.

```tsx
<ThinkingLevelUnavailable options={options} label="Thinking" reason="Only Ward can change it." value="medium" />
```
