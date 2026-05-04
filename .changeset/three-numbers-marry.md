---
'@mastra/core': patch
---

Fixed serializeRequestContext to handle plain Map instances passed as requestContext, restoring backward compatibility broken in #16061
