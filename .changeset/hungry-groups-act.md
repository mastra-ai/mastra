---
'@mastra/playground-ui': patch
---

Added `presentTool` to the `ai/tool-call` component set: maps a tool name and its arguments to an icon, a human label, and the salient argument to surface on the row (with special handling for terminal-style tools whose command drives the expanded body). Added `ToolCallMono`, the monospace body block of an expanded call with a hover copy button, and `ToolCallPresentedHeader`, the canonical row header (icon, label, detail, failure mark, chevron) so apps no longer assemble it by hand. `ToolCallDetail` now fades in on its own when it lands inside an `ArrivalScope`. All moved from Mastra Factory so every studio surface presents tool calls the same way.

```tsx
import {
  ToolCall,
  ToolCallContent,
  ToolCallMono,
  ToolCallPresentedHeader,
  ToolCallTrigger,
  presentTool,
  stringifyToolValue,
} from '@mastra/playground-ui/components/ai/tool-call';

const { icon, label, detail } = presentTool(toolName, args);

<ToolCall status={isRunning ? 'running' : 'idle'}>
  <ToolCallTrigger>
    <ToolCallPresentedHeader icon={icon} label={label} detail={detail} />
  </ToolCallTrigger>
  <ToolCallContent>
    <ToolCallMono copyText={stringifyToolValue(result)}>{stringifyToolValue(result)}</ToolCallMono>
  </ToolCallContent>
</ToolCall>;
```

