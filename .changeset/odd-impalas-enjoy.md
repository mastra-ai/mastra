---
'@mastra/factory': patch
---

Fixed the Factory getting stuck after a GitHub App is uninstalled and reinstalled.

GitHub assigns a new installation ID on reinstall, which left every token request failing against the old one — recovering it needed a manual database edit. The Factory already knew how to repoint a repository at the replacement installation, but only triggered that recovery when the platform reported the old installation as missing (404). A suspended or soft-deleted installation reports as a conflict (409) instead, so the recovery never ran. It now covers both.

A failed token mint that could equally be a transient GitHub outage (502) still surfaces as an error rather than repointing the repository, so a passing incident never migrates a healthy repository.
