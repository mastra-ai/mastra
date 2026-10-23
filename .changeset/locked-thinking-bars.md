---
'@mastra/playground-ui': patch
---

Added an optional `value` to `ThinkingLevelUnavailable`, so a control that is locked rather than unsupported still shows the level in effect, and screen readers hear it (`Thinking: Medium. Only Ward can change it.`).

```tsx
<ThinkingLevelUnavailable options={options} label="Thinking" reason="Only Ward can change it." value="medium" />
```
