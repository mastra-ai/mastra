---
'@mastra/core': minor
---

Add workflow execution path tracking and optimize verbose logs

This change introduces `stepExecutionPath` tracking throughout the workflow execution system to provide visibility into the actual execution path taken during workflow runs. The execution path is now propagated through:

- Workflow execution context and results
- Time travel, restart, and resume operations
- Lifecycle callbacks and step updates
- Result formatting and persistence

Additionally, optimizes workflow output by making step result `payload` fields optional and conditionally removing duplicate payloads when they match the previous step's output. This reduces context usage and produces more compact, user-friendly execution logs while maintaining full execution path visibility.

**Key improvements:**
- Added `stepExecutionPath?: string[]` to ExecutionContext, WorkflowState, WorkflowResult variants, and related types
- Optimized payload handling to eliminate duplication in execution JSON
- Enhanced fmtReturnValue to support path-aware payload trimming
- Extended resume/restart/time-travel payloads to carry execution path information

This is particularly beneficial for AI agents and LLM-based workflows where reducing context size improves performance and cost efficiency.
