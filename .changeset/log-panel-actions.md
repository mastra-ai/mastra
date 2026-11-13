---
'@mastra/playground-ui': minor
---

`LogDataPanel` accepts an `actions` prop to render extra controls in its header, next to the previous and next buttons.

```tsx
<LogDataPanel
  {...panelProps}
  actions={<Button onClick={() => askAbout(log)}>Ask about this log</Button>}
/>
```
