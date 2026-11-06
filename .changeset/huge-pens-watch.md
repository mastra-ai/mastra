---
'mastra': minor
'@mastra/factory': patch
---

Added `mastra api factory connect-tools get` and `mastra api factory connect-tools update` to read and change which Mastra Connect providers Factory sessions in your organization can use. Updating is limited to organization admins.

```bash
mastra api factory connect-tools update '{"enabledProviders":["linear","slack"]}'
```
