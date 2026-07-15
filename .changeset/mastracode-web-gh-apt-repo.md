---
'mastracode-web': patch
---

Install the GitHub CLI (`gh`) from GitHub's official apt repository in the Railway sandbox template. The prior `withPackages('git', 'gh')` call depended on the Debian community `gh` package, which is not reliably available (or reliably current) across the base Debian releases Railway ships and which upstream GitHub CLI maintainers explicitly advise against. Templates that failed to build (`Sandbox template <hash> failed to build in environment <env-id>`) will now succeed and produce a `gh` that stays current with GitHub's API changes.
