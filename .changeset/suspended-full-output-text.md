---
'@mastra/core': patch
---

Fixed `getFullOutput().text` dropping text from the step in progress when a run suspends for tool approval or a tool suspension after an earlier step has completed. It now matches `output.text` on every engine, including resumed runs that suspend again.
