---
'@mastra/playground-ui': patch
---

Added `groupConsecutive`, `TOOL_GROUP_MIN` and `isTaskTool` to `components/ai/tool-call`.

`groupConsecutive` cuts a list into runs of consecutive items that belong together and keys each run by its first member, so a chat can collapse a burst of tool calls into a single `ToolCallGroup` row instead of one row per call. Runs shorter than `TOOL_GROUP_MIN` (3) are left alone; pass `min` to change that.

```tsx
import { groupConsecutive } from '@mastra/playground-ui/components/ai/tool-call';
import type { MessageFactoryPart, ToolInvocationPart } from '@mastra/react';

const isToolCall = (part: MessageFactoryPart): part is ToolInvocationPart => part.type === 'tool-invocation';

const toolGroups = (parts: readonly MessageFactoryPart[]) =>
  groupConsecutive(parts, { key: part => part.toolInvocation.toolCallId, joins: isToolCall });

// byFirstKey.get(id) -> the run to draw as one group row
// memberKeys.has(id) -> already drawn inside a group row
```

`isTaskTool` names the tools that belong in a docked task list rather than in the transcript, so a chat can hide them consistently.

```tsx
import { isTaskTool } from '@mastra/playground-ui/components/ai/tool-call';

isTaskTool('task_update'); // true
```
