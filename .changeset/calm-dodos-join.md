---
'@mastra/memory': patch
'@mastra/core': patch
---

Added `settled()` to the base memory class. Memory implementations can do work in the background after an agent run returns, and this gives callers a way to wait for it before closing a storage connection they own. The default implementation does nothing; `@mastra/memory` overrides it.
