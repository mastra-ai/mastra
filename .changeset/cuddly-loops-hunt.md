---
'@mastra/deployer': patch
---

Fixed `mastra build` writing the wrong dependency when the app imports a package subpath that ships its own `package.json`, such as `read-excel-file/node` or `preact/jsx-runtime`. The generated `.mastra/output/package.json` contained `"read-excel-file": "npm:read-excel-file/node@1.0.0"`, which pnpm rejects with `ERR_PNPM_INVALID_PACKAGE_NAME`, or `"preact": "npm:jsx-runtime@1.0.0"`, which installs an unrelated package. It now pins the installed version, for example `"read-excel-file": "9.3.12"`. Fixes #28828.
