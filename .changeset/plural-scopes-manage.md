---
'@mastra/factory': patch
---

Provider credentials can now be managed per scope after initial setup. The provider listing reports the caller's personal and org credentials independently (`userCredential`/`orgCredential` on `ProviderInfo`), so the settings UI shows separate sign-out actions for each scope and lets org admins add an org-wide OAuth sign-in while personally signed in (and vice versa) without signing out first.
