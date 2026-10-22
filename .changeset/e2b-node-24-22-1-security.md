---
'@mastra/e2b': patch
---

The default E2B sandbox template now installs Node.js 24.22.1, which includes the [October 2026 Node.js security fixes](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).

Repo templates created with `createRepoTemplate` now build on that patched runtime too. Previously, repo templates already cached on the older Node.js version kept being reused after the default template changed.

Existing sandboxes and cached templates are not changed in place. New sessions build fresh templates on first start, so expect one cold build per repository after upgrading.
