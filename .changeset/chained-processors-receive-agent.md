---
'@mastra/core': patch
---

Fixed `processInput()` receiving `agent: undefined` in every input processor after the first. An agent with two or more input processors now passes the running agent to each of them, as `ProcessInputArgs.agent` documents. This matters most with memory enabled, because memory processors run first and configured processors never received the agent. Fixes #28349.
