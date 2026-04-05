---
'mastra': minor
---

Added `mastra auth` command for platform authentication. Includes `login`, `logout`, `whoami`, `orgs`, `orgs switch`, `tokens`, `tokens create`, and `tokens revoke` subcommands. Credentials are persisted locally in `~/.mastra/credentials.json` and tokens are automatically refreshed on expiry.
