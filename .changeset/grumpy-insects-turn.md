---
'@mastra/playground-ui': patch
'@mastra/react': patch
---

Fixed an unnecessary inner scrollbar showing up in the dataset items list when only a few items are present. The list rows container had a redundant overflow alongside the parent EntityList scroll container.
