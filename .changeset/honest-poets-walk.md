---
'@mastra/playground-ui': patch
---

`ToolCallPresentedHeader` accepts an optional `leading` slot so consumers can render content ahead of the tool icon, such as a timestamp:

```tsx
<ToolCallPresentedHeader leading={<time>3:42:05 PM</time>} icon={FileText} label="read_file" />
```
