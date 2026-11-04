---
'@mastra/playground-ui': minor
---

Studio now shows how a sandbox command ended. Before, chat messages never handed a command's streamed output, exit code or workspace link to its tool call, so a command that failed after printing something looked like a success. Now a non-zero exit marks the call failed, on its own row and in its tool group's failure count, next to an `exit N` or `killed` chip. Opening it shows what the command printed, followed by its exit code and any error. While it runs, you can scroll up through its output without it jumping back to the latest line on every update.

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
