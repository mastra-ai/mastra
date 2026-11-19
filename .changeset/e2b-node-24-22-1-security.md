---
'@mastra/e2b': patch
---

Repo templates created with `createRepoTemplate` now rebuild when the default E2B sandbox template changes. Previously, a repo template already cached on an older Node.js version kept being reused after the default template moved to Node.js 24.22.1, so sandboxes could keep running a runtime without the [October 2026 Node.js security fixes](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).

Existing sandboxes are not changed in place. New sessions build fresh repo templates on first start, so expect one cold build per repository after upgrading.
