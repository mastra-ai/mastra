---
'@mastra/deployer': patch
---

Fixed dependency version resolution in monorepos.

Previously, dependency versions were resolved at bundle time without the correct context path, which could cause incorrect version resolution in monorepos with hoisted dependencies. This often resulted in falling back to `latest` instead of the actual installed version.

Now, dependency versions are captured during the analysis phase using the correct entry root path context, ensuring accurate version resolution regardless of monorepo structure.
