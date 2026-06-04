---
'@mastra/github-signals': patch
---

Gate GitHub signal notifications behind author permission checks to guard against prompt injection from random commenters. Only comments from users with write access (admin, maintain, write) trigger notifications. Bots are allowed by default but can be blocked via the `ignoredBots` option.

New options on `GithubSignalsOptions`:
- `authorizedPermissions` — permission levels that authorize human commenters (default: `['admin', 'maintain', 'write']`)
- `ignoredBots` — bot logins whose comments should NOT trigger notifications
- `permissionResolver` — injectable resolver for looking up collaborator permissions (default: `gh api`)
