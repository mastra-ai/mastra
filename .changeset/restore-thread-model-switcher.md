---
'@mastra/playground': patch
---

Restore the model switcher in the agent thread chat composer. The `/agents/:agentId/threads/:threadId` page is mounted outside `AgentLayout` and was missing the `PlaygroundModelProvider`, so the provider/model pill and model settings disappeared and model overrides were never sent with chat requests.
