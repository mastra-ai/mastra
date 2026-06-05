---
'@mastra/github-signals': patch
---

Gate GitHub signal notifications behind author permission checks to guard against prompt injection from random commenters. Only comments from users with write access (admin, maintain, write) trigger notifications. Bots are allowed by default but can be blocked via the `ignoredBots` option. Scheduled polls now include comments and detect latest-comment timestamp changes so comment notifications are not lost behind stale or unchanged thread hashes, simultaneous PR state and comment changes emit separate notifications, and comment activity notifications render the latest comment author and excerpt as high-priority updates before lower-priority PR state updates from the same poll.

New options on `GithubSignalsOptions`:
- `authorizedPermissions` — permission levels that authorize human commenters (default: `['admin', 'maintain', 'write']`)
- `ignoredBots` — bot logins whose comments should NOT trigger notifications
- `permissionResolver` — injectable resolver for looking up collaborator permissions (default: `gh api`)
