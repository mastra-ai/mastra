---
'@mastra/connect': patch
---

Explain Microsoft Graph's misleading workbook 401 on personal accounts. Graph reports "the Excel workbook API does not exist for consumer OneDrive" as a 401 `FileOpenUserUnauthorized`, which read like a dead credential or file-sharing problem. Excel tool errors on personal Microsoft accounts now state the real cause: the workbook API only supports OneDrive for Business and SharePoint, the connection itself is still valid, and file-level tools keep working. Nested provider error codes (`{ error: { code } }`, the Graph/OpenAI shape) are now extracted alongside the message.
