---
'@mastra/deployer': patch
---

Fixed bundling to correctly exclude subpath imports of external packages. Previously, when a package like `lodash` was marked as external, subpath imports such as `lodash/merge` were still being bundled incorrectly. Now all subpaths are properly excluded.

Fixes #10055
