---
'mastracode': patch
---

Automatically fall back to a local sandbox provider for MastraCode Web when no Railway token is configured, so GitHub-backed repo projects can always be opened.

Previously opening a GitHub repo project required Railway; with no token configured the server returned "This server has no sandbox provider configured, so GitHub repos can't be opened." The sandbox provider is now selected automatically: Railway when `RAILWAY_API_TOKEN` is set, otherwise a local provider that clones and runs git directly on the server host (under `~/.mastracode/web/sandboxes`, overridable via `MASTRACODE_LOCAL_SANDBOX_ROOT`). `MASTRACODE_SANDBOX_PROVIDER` still works as an explicit override.

The local provider implements the same sandbox interface as Railway (start/exec/teardown over `sh -c`), so clone, commit, push, and PR flows work unchanged. It requires `git` (and `gh` for pull requests) on the host.

Note: the local provider runs on the host process with no tenant isolation and is intended for single-user local development only — configure Railway for shared multi-tenant deployments.
