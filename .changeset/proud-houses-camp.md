---
'@mastra/core': patch
---

On Linux, commands that `LocalSandbox` runs now raise their own out-of-memory score, so when a command uses up the memory it shares with your agent, the kernel kills the command instead of the agent. The agent sees `Killed` and exit code 137 in the tool result and can try again with less memory. Set `MASTRA_COMMAND_OOM_SCORE_ADJ` to a value from 1 to 1000 to change the score (the default is 500), or to `0` or `off` to turn it off. Nothing changes on macOS or Windows.
