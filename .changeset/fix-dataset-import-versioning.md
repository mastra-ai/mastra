---
'@mastra/playground-ui': patch
---

Fix dataset import creating a new version per item. CSV and JSON import dialogs now use the batch insert endpoint so all imported items land on a single version.
