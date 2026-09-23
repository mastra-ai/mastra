---
'@mastra/code-sdk': patch
---

Missing provider credentials for signed-in Factory accounts now throw `ProviderAuthRequiredError` instead of a plain `Error`, so hosts can classify the failure as an authentication error without matching on the message text.
