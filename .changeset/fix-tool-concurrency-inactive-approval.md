---
'@mastra/core': patch
---

Fix tool-call concurrency incorrectly running tools in parallel when a registered approval or suspending tool is active but not called in a given step. The agentic execution loop recomputed concurrency from the tools the model actually called (`calledToolNames`) instead of the step's effective active tool set, so an available-but-uncalled approval/suspending tool no longer forced sequential execution. Concurrency is now recomputed from the step's active tools, preserving sequential execution when approval/suspension may be required while still allowing safe parallel tool calls when the suspending tools are inactive.
