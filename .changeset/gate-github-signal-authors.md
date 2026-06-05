---
'@mastra/github-signals': patch
---

Gate GitHub signal notifications behind author permission checks to guard against prompt injection from random commenters. Only comments from users with write access (admin, maintain, write) trigger notifications. Bot comments are opt-in via an allowlist that defaults to CodeRabbit and Devin, with `ignoredBots` still available as an explicit blocklist. Unauthorized latest comments are stripped before notification classification so noisy bot edits do not render in CI/state notification metadata. Scheduled polls now include comments and detect latest-comment timestamp changes so comment notifications are not lost behind stale or unchanged thread hashes, simultaneous PR state and comment changes emit separate notifications, and comment activity notifications render the latest comment author and excerpt as high-priority updates before lower-priority PR state updates from the same poll.

New options on `GithubSignalsOptions`:
- `authorizedPermissions` — permission levels that authorize human commenters (default: `['admin', 'maintain', 'write']`)
- `authorizedBots` — bot logins authorized to trigger notifications (default: `['coderabbitai[bot]', 'devin-ai-integration[bot]']`)
- `ignoredBots` — bot logins whose comments should NOT trigger notifications, even if authorized
- `permissionResolver` — injectable resolver for looking up collaborator permissions (default: `gh api`)
