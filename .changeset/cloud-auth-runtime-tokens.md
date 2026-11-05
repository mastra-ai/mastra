---
'@mastra/deployer-cloud': patch
---

The generated cloud auth entrypoint now reads `PLAYGROUND_JWT_TOKEN` and `BUSINESS_JWT_TOKEN` when the server starts instead of copying their values into the build output. Rotating a token no longer needs a rebuild, and the tokens no longer end up in the bundle.
