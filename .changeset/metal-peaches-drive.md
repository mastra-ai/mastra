---
'@mastra/schema-compat': patch
'@mastra/github-signals': patch
'@mastra/core': patch
'mastracode': patch
---

Fixed a crash when MastraCode builds Harness v1 modes after the agentId field was removed from the mode shape. The backing agent is now carried through mode metadata.
