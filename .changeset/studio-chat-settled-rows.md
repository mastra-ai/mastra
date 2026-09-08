---
'mastra': patch
---

Improved Studio chat performance on long threads. While the agent streams a reply, only the message being written is redrawn; every settled message keeps its rendered output instead of re-rendering on each token.
