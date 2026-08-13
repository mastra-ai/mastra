---
'@mastra/deployer': patch
---

Fixed deploys from a monorepo failing while installing dependencies.

Workspace packages that the bundler compiles into the build output are no longer also written to `.mastra/output/package.json` as `file:./workspace-module/<pkg>.tgz` dependencies. Deploy targets that install from `package.json` alone were failing on those tarballs with repeated `tarball data ... seems to be corrupted` warnings followed by `ENOENT`, because the files were not available to that install.

Workspace packages the bundle still imports at runtime — those exported only through subpaths, such as `exports: { './value': './value.js' }` — keep shipping as tarballs, so subpath-only dependencies continue to work.

Builds whose workspace packages are all bundled now emit a `package-lock.json` again, letting deploy targets skip version resolution.

Fixes #21129.
