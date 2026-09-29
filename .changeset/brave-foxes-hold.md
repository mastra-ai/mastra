---
'mastra': patch
---

Fixed output speed readings in the bundled Mastra Code web interface that jumped to thousands of tokens per second. Thinking and text are now timed from when the model starts each block, and a response the provider sends all at once keeps the previous reading instead of showing an impossible rate.
