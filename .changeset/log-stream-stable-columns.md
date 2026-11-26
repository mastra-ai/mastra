---
'@mastra/playground-ui': patch
---

Fixed `LogView` columns shifting while you scroll. When only lines without a time or level were on screen, such as build output, the Time and Level columns shrank and the messages jumped sideways once timed lines scrolled in. The columns now keep the width of a full time and level.
