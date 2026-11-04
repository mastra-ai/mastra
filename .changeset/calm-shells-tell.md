---
'@mastra/playground-ui': minor
---

Studio now shows how a sandbox command ended. Before, chat messages never handed a command's streamed output, exit code or workspace link to its tool call, so a command that failed after printing something looked like a success. Now a non-zero exit marks the call failed, on its own row and in its tool group's failure count, next to a chip saying how it ended: `exit N`, `killed`, `timed out`, or `error` when the sandbox could not run it. Opening it shows what the command printed, followed by its exit code and the full error, even one that spans several paragraphs. While it runs, you can scroll up through its output without it jumping back to the latest line on every update.

`ToolCallOutput` no longer takes `maxLength`: a long result shows in full, scrolling inside its box, and still copies whole.

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
  exit, // { exitCode, killed, timedOut, error }
};

{exit && <ToolCallExitStatus exit={exit} />}
{toolCallHasBody(view) && <ToolCallBody {...view} />}
```
