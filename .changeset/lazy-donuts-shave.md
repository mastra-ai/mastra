---
'@mastra/deployer': patch
---

feat: add dynamicPackages bundler config for runtime-loaded packages and auto detect pino

Adds a new `dynamicPackages` bundler config option for packages that are loaded
dynamically at runtime and cannot be detected by static analysis (e.g.,
`pino.transport({ target: "pino-opentelemetry-transport" })`).

Additionally, pino transport targets are now automatically detected from the
bundled code, so most pino users won't need any configuration.

This keeps `externals` for its intended purpose (packages to not bundle) and
provides a clear mechanism for dynamic packages that need to be in the output
package.json.

Fixes #10893
