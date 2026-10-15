---
'@mastra/factory': patch
---

Added `payer` to the session model catalog (`GET /web/config/models?resourceId=…&threadId=…`): the user who pays for the thread, or none when the organization pays, and whether each model provider runs on a subscription or an API key.
