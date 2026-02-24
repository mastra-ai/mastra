---
'@mastra/ai-sdk': patch
---

Fixed withMastra() re-persisting prior message history on later turns. When using generateText() multiple times on the same thread, previously stored messages were duplicated in storage. Historical messages loaded by the MessageHistory processor are now correctly tagged as 'memory' source in the output phase, preventing them from being re-saved. (fixes #13438)
