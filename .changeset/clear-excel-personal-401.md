---
'@mastra/connect': patch
---

Add actionable account-type guidance to Microsoft Graph tenant-directory and SharePoint errors, which require a work or school account. Nested provider error codes (`{ error: { code } }`, the Graph/OpenAI shape) are now surfaced even when the provider returns an empty message.
