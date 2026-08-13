---
'@mastra/playground-ui': patch
---

Fixed code blocks flickering between colored and plain text while an agent streams a fenced snippet. Syntax highlighting runs one frame behind the text, and every delta used to throw the previous colors away before the new ones arrived. The settled part of the snippet now keeps its colors and only the characters that just landed wait, uncolored, for the next highlighting pass.
