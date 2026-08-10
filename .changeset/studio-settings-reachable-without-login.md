---
'@internal/playground': patch
---

Fixed Studio locking you out when authentication is enabled but the provider has no login screen, for example `MastraJwtAuth`. The Settings page now stays open so you can save the `Authorization` header, and the authentication screen links to it. Studio checks your access again as soon as you save, so you get in without a page reload. All other pages stay protected.
