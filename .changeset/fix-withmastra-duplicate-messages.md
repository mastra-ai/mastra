---
'@mastra/ai-sdk': patch
---

Fixed withMastra() re-persisting prior message history on later turns. When using generateText() multiple times on the same thread, previously stored messages were duplicated in storage. (fixes #13438)
