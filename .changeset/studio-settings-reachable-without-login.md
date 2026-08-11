---
'@internal/playground': patch
---

Fixed Studio locking you out when authentication is enabled but the provider has no login screen, for example `MastraJwtAuth`. The blocked "Authentication Required" screen now shows a header form, so you can save the `Authorization` header right there. Studio checks your access again as soon as you save, so you get in without a page reload. No route is exempted from the auth gate; every page stays protected until the server accepts your header.

**Limitation:** on Mastra Platform the header form is not shown. The screen keeps the "contact your administrator" message, because the platform manages the connection headers.
