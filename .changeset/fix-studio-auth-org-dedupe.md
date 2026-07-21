---
'@mastra/auth-studio': patch
---

`MastraAuthStudio.ensureOrganization` now dedupes concurrent bootstraps for the same user, so parallel tabs or requests for a brand-new sign-in no longer end up creating duplicate personal organizations.
