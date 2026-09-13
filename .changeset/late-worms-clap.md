---
'@mastra/core': patch
---

Fixed durable agent output processor handling to match the regular agent:

- tool results now run through the processToolResult hook exactly once, and through the processOutputStream hook exactly once (previously processToolResult never ran and processOutputStream ran multiple times)
- an output processor that calls abort with retry now makes the agent call the model again, bounded by maxProcessorRetries, instead of ending the run
- after a terminal tripwire the public stream now still reaches its finish chunk, with the tripwire recorded on the result

Fixes #22980
