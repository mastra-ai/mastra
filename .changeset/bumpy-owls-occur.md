---
'@mastra/express': patch
'@mastra/hono': patch
'@mastra/deployer': patch
'@mastra/server': patch
---

Extract routing from @deployer/server into server adapter packages.
New packages:
- @mastra/express
- @mastra/hono

These packages support mastra server routes on express and hono respectively.
Better abstractions will be built on top of these packages in the near future, enabling users to easily attach mastra routes to any existing server framework.