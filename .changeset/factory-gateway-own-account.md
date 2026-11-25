---
'@mastra/factory': patch
'mastra': patch
---

On a Factory whose deployment provides its own Mastra Gateway key, you can now connect your own Mastra account from Settings → Models → Add provider. Members can connect it for their own sessions and organization admins for the whole organization; that account is then billed instead of the deployment's. Setup still uses the deployment's key and creates no second one.
