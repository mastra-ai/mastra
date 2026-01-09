---
'@mastra/deployer': patch
---

fix: include user-specified externals in output package.json

Packages listed in the bundler `externals` config are now always added to the
output package.json dependencies. Previously, externals were only included if
detected during static analysis, which missed dynamically-imported packages
(e.g., `pino.transport({ target: "pino-opentelemetry-transport" })`).

Fixes #10893
