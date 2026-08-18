---
'@mastra/factory': patch
---

Keep kickoff skill resolution off the sandbox so clicking Review on a board card no longer blocks on full sandbox provisioning. Project skill roots (`.claude/skills`, `.agents/skills`, `<configDir>/skills`) are guarded while the session sandbox is unmaterialized — discovery reports them empty instead of forcing materialization — and a skills rescan fires automatically once materialization completes so repo-local skills become visible. Bundled Factory skills (e.g. factory-review) resolve from local disk in milliseconds.
