---
'@mastra/code-sdk': patch
---

Improved ACP session shutdown by waiting up to two seconds for pending notification dispatch and stopping workers before closing session resources.
