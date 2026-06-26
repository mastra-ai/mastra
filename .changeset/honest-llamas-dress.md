---
'@mastra/memory': minor
'@mastra/core': patch
---

add working memory extractor and injectTools config

Adds a built-in WorkingMemoryExtractor for the observtional
memory extractor pipeline. When included in observation or
reflection config, the observer/reflector can update working
memory through the normal extractor pipeline instead of
requiring the main agent to call the working memory tool.

Adds injectTools: boolean (default true) to BaseWorkingMemory.
Set to false to prevent the working memory update tool from
being injected into the main agent.
