---
'@mastra/deployer': patch
'@mastra/core': patch
---

Fixed saved tool approvals disappearing after a server restart. Sessions restore the pending prompt from native run storage and deliver the decision to the original saved run without automatically executing the tool.
