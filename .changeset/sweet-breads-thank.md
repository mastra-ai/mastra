---
'@mastra/core': patch
---

Fixed browser state signal showing 'Browser is closed' when the agent never used the browser. Added closeReason field to differentiate between agent-initiated close, user action, process restart, or error.
