---
'@mastra/playground-ui': patch
---

Fixed adding dataset items with plain text. The Add item dialog and Add trace to dataset now accept plain text as the input and ground truth. Previously, only JSON was accepted. Text that is valid JSON is still saved as JSON, and anything else is saved as a string.
