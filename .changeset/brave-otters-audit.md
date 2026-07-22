---
'@mastra/factory': patch
---

Move the WorkOS audit integration into `@mastra/factory/integrations/workos`. Its Admin Portal route now resolves the caller through the `RouteAuth` seam on `IntegrationContext` instead of web-host auth helpers, and `@mastra/auth-workos` becomes a package dependency.
