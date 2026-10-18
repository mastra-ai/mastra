---
'@mastra/core': patch
---

Fixed thread titles being generated from an automatic "Continue." message that Mastra adds for models such as Gemini 3. Title generation now ignores that message, and a thread that contains only an assistant message no longer gets a title made from "Continue.".
