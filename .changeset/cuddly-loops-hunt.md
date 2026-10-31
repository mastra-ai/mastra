---
'@mastra/deployer': patch
---

Fixed `mastra build` failing with `ERR_PNPM_INVALID_PACKAGE_NAME` when the app imports a package subpath whose folder ships its own `package.json`, such as `read-excel-file/node`. The generated `.mastra/output/package.json` contained an invalid entry like `"read-excel-file": "npm:read-excel-file/node@1.0.0"`. For subpaths like `preact/jsx-runtime` it could instead install an unrelated npm package under the dependency's name. The output now pins the installed package version, for example `"read-excel-file": "9.3.12"`. Fixes #28828.
