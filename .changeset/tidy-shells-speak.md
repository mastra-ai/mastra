---
'@mastra/playground-ui': minor
---

Tool call rows for `execute_command` now show the command's `description` on its own when the agent provides one, for example `Finding the processor wiring` instead of `Run` followed by a long `rg` pipeline. Expanding the row still shows the full command, and calls without a description are unchanged.

`presentTool` returns the description as a new `description` field alongside the existing `label` and `detail`, and `ToolCallPresentedHeader` accepts a matching `description` prop that it shows in place of the label and detail. Tool group headers show a running command's description the same way.

```tsx
import { presentTool, ToolCallPresentedHeader } from '@mastra/playground-ui/components/ai/tool-call';

const { command, ...presentation } = presentTool('execute_command', {
  description: 'Finding the processor wiring',
  command: "rg -n 'processor' src | head -20",
});
// presentation.label === 'Run'
// presentation.detail === "rg -n 'processor' src | head -20"
// presentation.description === 'Finding the processor wiring'

// The row reads "Finding the processor wiring"
<ToolCallPresentedHeader {...presentation} />;
```
