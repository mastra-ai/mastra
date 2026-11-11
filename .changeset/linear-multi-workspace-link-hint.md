---
'@mastra/factory': patch
---

Fixed the Linear issue tool telling agents that every issue links under one workspace when an org connects several Linear workspaces. With more than one workspace connected, the tool no longer suggests a single URL pattern and instead tells agents to link an issue with its own `url`.
