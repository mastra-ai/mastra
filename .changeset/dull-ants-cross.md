---
'mastra': patch
---

Fixed `mastra deploy` creating a plain Studio project when deploying a Mastra Factory project for the first time. New projects for Factory deployments are now created with the factory flag, so the platform provisions workspace sandboxes and the `<slug>.factory.mastra.cloud` route. The deployment region is asked once for a new Factory project and reused for its environment. Deploying a Factory build into an existing project that was created without Factory support now explains the problem and offers to create a new Factory project instead, since that support cannot be added later. The legacy `mastra server deploy` also creates Factory projects with the flag and sends it on the deploy request, and `mastra studio deploy` warns that it cannot enable Factory support.
