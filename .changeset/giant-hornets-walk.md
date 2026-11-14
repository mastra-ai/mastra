---
'@mastra/deployer': patch
---

Fixed Studio returning 404 when you refresh or open a link whose path contains a dot, such as `/agents/lead.agent` or `/agents/lead.agent/threads`. Missing files under `/assets/` still return 404. Fixes [#30296](https://github.com/mastra-ai/mastra/issues/30296).
