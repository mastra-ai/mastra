# @mastra/github-signals

## 0.1.1-alpha.0

### Patch Changes

- Gate GitHub signal notifications behind author permission checks to guard against prompt injection from random commenters. Only comments from users with write access (admin, maintain, write) trigger notifications. Bot comments are opt-in via an allowlist that defaults to CodeRabbit and Devin, with `ignoredBots` still available as an explicit blocklist. Unauthorized latest comments are excluded before notification classification so noisy bot edits do not render in notification metadata or mask the latest authorized comment. Scheduled polls now include comments and detect latest-comment timestamp changes so comment notifications are not lost behind stale or unchanged thread hashes. Comment activity notifications render the latest authorized comment author and excerpt as high-priority GitHub signal updates. ([#17590](https://github.com/mastra-ai/mastra/pull/17590))

  New options on `GithubSignalsOptions`:
  - `authorizedPermissions` — permission levels that authorize human commenters (default: `['admin', 'maintain', 'write']`)
  - `authorizedBots` — bot logins authorized to trigger notifications (default: `['coderabbitai[bot]', 'devin-ai-integration[bot]']`)
  - `ignoredBots` — bot logins whose comments should NOT trigger notifications, even if authorized
  - `permissionResolver` — injectable resolver for looking up collaborator permissions (default: `gh api`)

- Updated dependencies [[`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`f2ab060`](https://github.com/mastra-ai/mastra/commit/f2ab060162bea81505fda553e2cee29c1979fd04), [`5d302c8`](https://github.com/mastra-ai/mastra/commit/5d302c8eda1a6ac74eab5e442c4f64db6cc97a06)]:
  - @mastra/core@1.42.0-alpha.1
