---
'@mastra/evals': patch
---

Fixed tool-use checks incorrectly passing when a tool threw an error.

A natively thrown tool call is stored as `state: 'output-error'`, which the Quick Checks did not recognize, and a call present only in `content.parts` was hidden whenever the message also carried a legacy `toolInvocations` array. As a result `checks.noToolErrors()` scored a perfect 1 for a failed tool, `calledTool` undercounted, and `didNotCall`, `usedNoTools`, `maxToolCalls`, and `toolOrder` could pass on runs where the tool did run and throw.

Tool calls are now merged from both message forms and thrown calls count as real, failed invocations — matching how `@mastra/core` already extracts trajectories. Fixes #23460.
