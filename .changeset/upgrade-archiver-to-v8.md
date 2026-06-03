---
'@mastra/cli': patch
---

Upgrade archiver from v7 to v8 in @mastra/cli

- Bumped `archiver` dependency from `^7.0.1` to `^8.0.0`
- Migrated `zipOutput` call sites to use the new `ZipArchive` class API (v8 breaking change)
- Updated test mocks in `deploy.test.ts` (server + studio) from `default` export to `ZipArchive`
- Confirms minimum Node version (`>=22.13.0`) is compatible with `archiver@8` (requires Node >=18)

Related issue: #17498
