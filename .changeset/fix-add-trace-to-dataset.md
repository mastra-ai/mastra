---
'@mastra/playground-ui': patch
---

Fix saving traces and scores as dataset items in the Studio.

- Traces with structured message content (e.g. multi-part content arrays) can now be saved as dataset items without validation errors
- Score dialog now has a "Save as Dataset Item" button for scorer calibration workflows, pre-filling scorer input/output and expected score
- Dataset output schema updated to match the full experiment output shape (text, object, toolCalls, files, usage, etc.)
