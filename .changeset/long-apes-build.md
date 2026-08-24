---
'@mastra/playground-ui': patch
---

Fixed code blocks stretching the page. A long line inside a fenced markdown block used to widen everything around it, pushing the layout past the window. A code block now keeps to the width it is given, and scrolls horizontally inside itself when set to `overflow="scroll"`.
