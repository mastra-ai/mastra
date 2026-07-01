---
'@mastra/core': patch
'mastra': patch
---

computeStateSignal processors (e.g. the default TaskSignalProvider's TaskStateProcessor) now gracefully skip with a debug log when the run has no memory-backed thread, instead of throwing and breaking the run. This aligns the processor with the task tools, which already no-op without memory, so agents configured with signal providers (like createCodingAgent) work in memoryless contexts such as the CLI.
