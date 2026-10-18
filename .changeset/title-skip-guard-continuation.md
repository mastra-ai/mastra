---
'@mastra/core': patch
---

Fixed thread title generation picking up the synthetic "Continue." message that the trailing assistant guard adds for models such as Gemini 3. Titles are now generated only from what the user actually wrote, and a thread that contains only an assistant message no longer gets a title made from "Continue.".
