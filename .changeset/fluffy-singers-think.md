---
'@mastra/code-sdk': patch
---

Clarified cross-agent peer states, required fresh discovery before sends, and added an explicit disconnect tool. Agents can remove a saved connection from the current sender thread with the peer's stable ID:

```text
agent_disconnect({ targetId: "code-agent:resource-id:thread-id" })
```
