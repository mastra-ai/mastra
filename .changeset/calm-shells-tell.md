---
'@mastra/playground-ui': minor
---

Studio now marks a command that exits with a non-zero code as failed, on its own row and in the failure count of its tool call group. Before, only the `exit N` chip set it apart from a successful call. Opening it shows the full result, including the error when the command could not run, instead of only what it printed.

Added the pieces Studio uses to draw a tool call, so other chat UIs can show tool calls and their failures the same way:

```tsx
import {
  exitedWithFailure,
  ToolCallBody,
  ToolCallExitStatus,
  toolCallHasBody,
} from '@mastra/playground-ui/components/ai/tool-call';

const view = {
  toolName,
  args,
  status: exitedWithFailure(toolName, exit?.exitCode) ? 'error' : status,
  output,
  result,
};

<ToolCallExitStatus exit={exit} />;
{toolCallHasBody(view) && <ToolCallBody {...view} />}
```
