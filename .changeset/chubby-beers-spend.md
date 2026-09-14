---
'@mastra/core': patch
---

Fixed an issue where calling sendSignal() from a processToolResult processor hook could silently drop the just-completed tool call and result from later model inputs and saved history. The in-flight response message is now only sealed when a message id rotation follows, so the next streamed step merges into it instead of replacing it. (#21940)
