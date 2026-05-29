---
'@mastra/core': patch
---

Fixed input step processor traces to show system messages added through `MessageList` mutations. Processors that call `messageList.addSystem(...)` during `processInputStep` now show the updated system messages in trace output.
