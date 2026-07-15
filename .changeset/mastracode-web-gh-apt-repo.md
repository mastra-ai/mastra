---
'mastracode-web': patch
---

Install the GitHub CLI (`gh`) at runtime in the Railway sandbox on first use, rather than at template-build time. The prior template chained an apt/keyring/repo bootstrap into `builder.run(...)` and Railway responded with `Sandbox template <hash> failed to build in environment <env-id>` — the SDK does not expose per-step build logs, so the failing shell command was undebuggable remotely. The runtime install (guarded by a `gh --version` probe so it runs at most once per sandbox) streams stderr through `executeCommand`, so a real failure now produces an actionable `gh-install-failed` error with the apt output attached.
