---
'@mastra/playground-ui': patch
---

Connect providers that use OAuth client credentials (`OAUTH2_CC`) or no authentication (`NONE`) without leaving Studio. Client-credential providers ask for a client ID and secret in the connect dialog; providers with no authentication connect immediately instead of opening an OAuth popup.

Providers whose catalog lists only connection settings (for example a subdomain) now also ask for their API key, username and password, or client ID and secret. Previously the dialog showed only the settings, and the connection failed.

The headless connect helpers in `@mastra/playground-ui/domains/connect` now return a fully resolved `HeadlessAuthField` and support conditional fields (`visibleWhen`), so other apps can import them instead of keeping their own copy.
