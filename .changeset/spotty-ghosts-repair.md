---
'@mastra/core': patch
---

Make dynamic tool approval callbacks additive with static approval requirements, so `needsApprovalFn` can require approval without overriding existing `requireApproval` settings. Also preserves declined approval results when a suspended sub-agent tool call is resumed through a supervisor agent.
