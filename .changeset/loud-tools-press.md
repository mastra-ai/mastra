---
'@mastra/deployer': patch
---

Fixed bundler not including user-specified externals in output package.json when packages are dynamically imported at runtime (e.g., pino transports). Packages listed in the `externals` config array are now always added to the output `package.json`, even if static analysis doesn't detect them as dependencies.
