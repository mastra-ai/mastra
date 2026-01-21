---
'@mastra/deployer': patch
---

Fixed dependency version resolution in monorepos.

Previously, dependency versions were resolved at bundle time without the correct context path, which could cause incorrect version resolution in monorepos with hoisted dependencies. This often resulted in falling back to `latest` instead of the actual installed version.

Now, dependency versions are captured during the analysis phase using the correct entry root path context, ensuring accurate version resolution regardless of monorepo structure.

Also added fallback resolution for deployer-provided packages (like `hono`) that may not be installed in the user's project but are dependencies of `@mastra/deployer` itself.

Fixed the merge logic for external dependencies to prefer entries with version information over entries without, ensuring version data isn't lost during the merge step.
