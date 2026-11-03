---
'@mastra/playground-ui': minor
---

A command that fails after printing output now shows its full result in Studio, including the error when the command could not run, instead of only what it printed.

Added `commandOutputText`, which picks the text to show for a command call from its streamed output, its result and whether it failed:

```ts
import { commandOutputText } from '@mastra/playground-ui/components/ai/tool-call';

const text = commandOutputText({ streamed, result, failed: exitCode !== 0 });
```
