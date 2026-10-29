---
'@mastra/core': patch
---

Fixed trace trees for agents whose model call is rejected and handled by an error processor (for example a retry on a rate limit). The "request error processor" spans now sit inside the model step whose call failed, next to that step's other processor spans, instead of showing up as a flat list under the agent run.
