---
"@mastra/core": patch
---

fix(durable-agent): populate MASTRA_THREAD_ID_KEY on step requestContext for input processors

The workflow engine injects a fresh RequestContext into each durable step,
so MASTRA_THREAD_ID_KEY was undefined when ToolSearchProcessor (and other
input processors) read it. The processor fell back to the 'default' bucket,
causing all threads to share one loaded-tool set and cold-loaded tools to
never appear on subsequent turns under DurableAgent.

Fix: before running input processors in the LLM execution step, copy
threadId and resourceId from typedInput.state onto the step's requestContext
if not already set — mirroring what preparation.ts does before the initial
processor run.

Note: the secondary issue (loaded-tool state lost across process boundaries
on true durable suspend/resume) requires persisting ToolSearchProcessor state
to working memory and is not addressed here.

Fixes #17714
