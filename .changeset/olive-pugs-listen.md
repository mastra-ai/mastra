---
'@mastra/factory': patch
---

Added `GET /web/github/projects/:id/commits` (optional `branch`, `limit`), which lists recent commits for an installed repository.

It reads with the same installation token that already clones and pushes, rather than through `getInstallationOctokit`: the Platform build answers that call with a stub carrying pull-request reads only, so anything reaching for `repos.*` would have been undefined at runtime while the cast kept the compiler quiet.
