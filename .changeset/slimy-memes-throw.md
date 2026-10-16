---
'@mastra/factory': patch
---

Added `payer` to the session model catalog (`GET /web/config/models?resourceId=…&threadId=…`): the user who pays for the thread (their name only when they have one, never their email), or none when the organization pays, and for each model provider either an API key or the subscription it bills, such as "Claude Pro/Max" or "SuperGrok/X Premium+".
