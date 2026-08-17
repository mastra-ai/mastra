---
'@mastra/playground-ui': minor
---

Added a reusable ToolCall component with the humanized labels, compact rows, command output, file writes, and diffs used by MastraCode Factory.

```tsx
import { ToolCall } from '@mastra/playground-ui/components/ai/tool-call';

<ToolCall
  toolName="execute_command"
  input={{ command: 'pnpm test' }}
  result="Tests passed"
  status="success"
/>;
```
