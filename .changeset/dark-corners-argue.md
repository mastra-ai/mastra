---
'@mastra/core': patch
---

`getSpeakers` endpoint returns an empty array if voice is not configured on the agent and `getListeners` endpoint returns `{ enabled: false }` if voice is not figured on the agent.

When no voice is set on agent don't throw error, by default set voice to undefined rather than DefaultVoice which throws errors when it is accessed.
