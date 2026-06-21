---
'@mastra/core': patch
---

Fixed tool calls running in parallel even when a tool that requires approval or can suspend was available in a step. This could let tool calls bypass an approval step when the model didn't call the approval tool that turn.

Tool calls now run one at a time whenever an approval or suspending tool is available in a step. Parallel tool calls are still allowed when no such tool is available.
