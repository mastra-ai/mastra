---
'@mastra/factory': patch
---

Agent replies now fade in word by word as they stream, instead of snapping whole chunks of text into place. Each word appears whole, so the visible text trails the stream by at most one word. A block that changes shape while it grows — a paragraph turning into a list item — fades again. Text that has finished streaming renders as before.
