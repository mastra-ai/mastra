---
'@mastra/core': patch
---

Fixed agent-controller sessions failing, reopening answered approvals or questions, or remaining busy when thread events are replayed. Delayed events and retried registrations no longer reactivate resolved tool calls. Genuinely pending approvals and later suspensions remain actionable. Also fixed a race that could mark a suspended run completed before its tool events finished broadcasting.
