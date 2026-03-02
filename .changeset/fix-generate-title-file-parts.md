---
'@mastra/core': patch
---

Fixed `generateTitleFromUserMessage` throwing a TypeError when the user message contains file parts (e.g., images). The method converts messages to UI format via `.ui()`, where file parts use `url` and `mediaType` properties, but the code was referencing `data` and `mimeType` from the core format. This caused thread titles to silently become empty strings.
