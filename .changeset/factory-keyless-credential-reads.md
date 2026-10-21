---
'@mastra/factory': patch
---

Fixed Factory servers without a credential encryption key silently damaging saved provider credentials. Previously such a server treated encrypted credentials as plain values, so providers showed as "Not set" with nothing in the logs. It could also rewrite the stored credentials so that servers with the key could no longer read them.

The server now refuses to read encrypted credentials without the key and logs a clear error, and saved credentials stay intact. Configure `secretEncryption` with the same key on every Factory instance to read them. Credentials damaged by the old behavior are repaired the next time a server with the key reads them.
