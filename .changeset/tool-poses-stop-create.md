---
'@mastra/playground-ui': minor
---

Added two agent indicator poses so a tool row shows what the call does. `kill_process` now shows `stopping`, a terminal with a stop square, instead of the running terminal. `mkdir` now shows `creating`, a folder with a plus, instead of the pen. `apply_patch` now shows as an edit instead of a generic tool.

```tsx
<AgentIndicator state="stopping" />
presentTool('kill_process', { pid: 42 }).pose; // 'stopping'
```

`presentedToolNames` lists every tool that `presentTool` gives its own pose and label.
