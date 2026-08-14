---
'@mastra/core': patch
---

Preserve channel approval cards when tool output is hidden or suppressed by a custom renderer.

Resolves https://github.com/mastra-ai/mastra/issues/21162

Custom renderers can reuse the built-in approval and tool-event formatting:

```ts
import {
  formatToolApproval,
  renderBuiltInToolEvent,
  type ToolDisplayFn,
} from '@mastra/core/channels';

const renderTool: ToolDisplayFn = event =>
  event.kind === 'approval'
    ? formatToolApproval(event.displayName, event.argsSummary, event.toolCallId, true)
    : renderBuiltInToolEvent(event, 'cards');
```
