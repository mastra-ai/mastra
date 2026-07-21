---
'@mastra/factory': patch
---

Move the filesystem routes (`@mastra/factory/routes/fs`) and skill routes (`@mastra/factory/routes/skills`) into `@mastra/factory`. The skill prepare/invoke routes are now a `SkillRoutes` class that resolves users and tenants through the `RouteAuth` seam instead of web-host auth helpers. Diagnostics fields exposed by the GitHub and Linear integrations rename `webAuthEnabled` to `factoryAuthEnabled` to match the package's auth seam naming.
