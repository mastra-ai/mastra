---
'@mastra/core': patch
---

Fixed an issue where writes to a shared RequestContext inside tools were lost because the tool received a cloned context instead of the original. Tool writes are now preserved by reusing the shared context instance.
