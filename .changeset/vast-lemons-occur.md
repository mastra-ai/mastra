---
'@mastra/core': patch
---

Fixed background tasks failing with "authenticated user is required" when fine-grained authorization is configured. Agent calls also no longer require users to hold workflows:execute on internal agent workflows; only agents:execute on the agent is checked. User-defined nested workflows are still authorized as before.
