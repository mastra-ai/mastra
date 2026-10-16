---
'@mastra/connect': patch
---

Add actionable account-type guidance to opaque Microsoft Graph errors. Tenant-directory and SharePoint failures now explain that those APIs require a work or school account, while ambiguous Excel workbook failures explain the OneDrive for Business and SharePoint requirement without masking explicit authentication errors. Nested provider error codes (`{ error: { code } }`, the Graph/OpenAI shape) are now preserved even when the provider returns an empty message.
