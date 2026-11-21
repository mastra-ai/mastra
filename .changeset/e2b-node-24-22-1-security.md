---
'@mastra/e2b': patch
---

Repo templates created with `createRepoTemplate` now rebuild when the default E2B sandbox template changes. Previously, a repo template already cached on an older Node.js version kept being reused after the default template moved to Node.js 24.22.1, so sandboxes could keep running a runtime without the [October 2026 Node.js security fixes](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).

Existing sandboxes are not changed in place. Each repo template configuration (repository, setup command, build env and resources) gets a new template name, so expect one cold build per configuration after upgrading: on the first session start, or earlier if you warm templates with `refreshRepoTemplate`.
