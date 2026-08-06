---
'@mastra/core': patch
'@mastra/deployer': patch
'@mastra/deployer-cloud': patch
'@mastra/deployer-netlify': patch
---

Install generated bundle dependencies from an optional configured lockfile: the lockfile's basename selects the package manager that installs the bundle, copied locks install with the manager's frozen command, and the npm frozen install tolerates peer overrides in deployer-generated lockfiles, while preserving automatic manager detection when no lockfile is configured.
