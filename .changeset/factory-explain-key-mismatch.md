---
'@mastra/factory': patch
---

Factory now explains why integrations and provider credentials are unavailable when its stored secrets can't be decrypted. Previously, a changed `FACTORY_CREDENTIAL_ENCRYPTION_KEY` showed only "github integration is unavailable." on the board and `credentials_unavailable` in provider settings, with nothing in the server log about integrations. Both errors now say the stored secrets were saved with a different encryption key, that they were not changed, and how to restore the key and redeploy. A new public `GET /web/status` reports this as a startup problem so the UI can show it once for the whole Factory. Boot also logs every storage domain that fails to initialize, along with its error.
