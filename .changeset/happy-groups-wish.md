---
'@mastra/memory': patch
---

Fixed buffered reflection splitting an observation group when `retrieval` is on. After the reflection activated, the agent's context could contain a stray `</observation-group>` and observations that recall could no longer trace back to their source messages. Buffered reflection now reflects or keeps each observation group whole. Fixes [#28445](https://github.com/mastra-ai/mastra/issues/28445).
