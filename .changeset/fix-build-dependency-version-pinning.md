---
'@mastra/deployer': patch
---

Fixed `mastra build` pinning the wrong version for a dependency whose `exports` map does not expose `./package.json`, such as `execa` 9. The build now reads the version from the copy of the package that the project really installs, so the generated `.mastra/output/package.json` no longer pins an older version and the deployed server starts correctly.
