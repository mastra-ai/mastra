---
'@mastra/playground-ui': minor
---

Added a composable tool-call component for building accessible, collapsible tool activity rows with custom icons, details, status content, and expanded results.

```tsx
import { ToolCall, ToolCallContent, ToolCallTrigger } from '@mastra/playground-ui/components/ai/tool-call';

<ToolCall status="running">
  <ToolCallTrigger>Running command</ToolCallTrigger>
  <ToolCallContent>Command output</ToolCallContent>
</ToolCall>;
```
