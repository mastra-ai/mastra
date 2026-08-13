---
'@mastra/playground-ui': patch
---

Fixed code blocks flickering between colored and plain text while an agent streams a fenced snippet. The part already highlighted now keeps its colors, and only the characters that just landed show uncolored until highlighting catches up.
