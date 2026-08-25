---
'@mastra/core': patch
---

Fix `steps[i].content` and `steps[i].toolCalls` being empty for input-step processors (`processInputStep`, `prepareStep`) and in the workflow output payload. Step content was extracted with a 0-indexed step count passed to a 1-indexed extractor and then sliced by message count, so the first step came back empty and later steps were misaligned. Completed steps now carry their real content, including tool results, which are re-read just before the next step's input processors run.
