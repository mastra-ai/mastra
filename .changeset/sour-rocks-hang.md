---
'@mastra/deployer': patch
---

Fixed builds that installed a dependency from the registry when the app declared it as a local link.

A dependency declared with `link:`, `file:` or a bare path, pointing outside the workspace, cannot be installed by the bundled app. The build used to substitute whatever version the linked directory declares, so the deployment shipped published code instead of the linked source — or failed on a version npm never published.

The build now stops and names the package and its specifier. Links replaced by an override are unaffected, and so are tarball URLs, which the deployment can fetch.
