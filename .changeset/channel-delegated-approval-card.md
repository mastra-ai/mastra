---
'@mastra/core': patch
---

Fixed channel approval cards for tools a sub-agent calls during a supervisor delegation. The card showed the supervisor's delegation call (`agent-<name>` and a truncated prompt) instead of the tool and arguments awaiting approval, so a user could approve a shell command without seeing it.
