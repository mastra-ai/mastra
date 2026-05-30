---
'@mastra/playground-ui': patch
'@mastra/react': patch
---

Fixed chat regressions in `useChat` and the message accumulator:

- Network sub-agent approvals and suspensions are surfaced again — the `agent-execution-approval` and `agent-execution-suspended` stream chunks now populate `requireApprovalMetadata`/`suspendedTools`, so a suspended or approval-gated child agent shows its Approve/Decline UI and stays resumable.
- A sub-agent's streamed child messages are preserved through the terminal tool result instead of being dropped at completion.
- Reloading a thread restores pending tool approvals (the Approve/Decline buttons no longer vanish on refresh) and hides completion-feedback messages flagged `suppressFeedback`, matching live-stream behavior.
